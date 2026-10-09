import type { CloudflareEnv } from "../../types/env";
import type { NoticeBoard, NoticeBoardDetail } from "../../types/notice";
import {
	bumpContentVersion,
	getSettingsVersionCached,
} from "../settings/service";
import { readIsolateCache, writeIsolateCache } from "../utils/isolateCache";
import { UserError } from "../utils/userError";
import { normalizeNoticeBoard, parseNoticePayload } from "./normalize";

const NOTICE_ROW_ID = 1;
const NOTICE_CACHE_SLOT = "notice.board";

interface NoticeRecord {
	id: number;
	title: string;
	sections_json: string;
	updated_at: string;
}

function recordToDetail(row: NoticeRecord): NoticeBoardDetail {
	let sections: NoticeBoard["sections"] = [];
	try {
		const parsed = JSON.parse(row.sections_json);
		sections = normalizeNoticeBoard({
			title: row.title,
			sections: parsed,
		}).sections;
	} catch {
		sections = [];
	}

	return {
		title: row.title,
		sections,
		updatedAt: row.updated_at,
	};
}

// isolate 版本缓存：公告变更走 bumpContentVersion（同源版本键）→ 版本变即失效，TTL 兜底。
// version 可显式传入（免重复解析）；省略时按当前配置/内容版本取。
export async function getNotice(
	env: CloudflareEnv,
	version?: string,
): Promise<NoticeBoardDetail | null> {
	const v = version ?? (await getSettingsVersionCached(env).catch(() => ""));
	const cached = readIsolateCache<NoticeBoardDetail | null>(
		NOTICE_CACHE_SLOT,
		v,
	);
	if (cached !== undefined) return cached;

	const row = await env.DB.prepare("SELECT * FROM notice_board WHERE id = ?")
		.bind(NOTICE_ROW_ID)
		.first<NoticeRecord>();

	const value = row ? recordToDetail(row) : null;
	writeIsolateCache(NOTICE_CACHE_SLOT, v, value);
	return value;
}

export async function upsertNotice(
	env: CloudflareEnv,
	raw: string,
): Promise<NoticeBoardDetail> {
	const normalized = parseNoticePayload(raw);

	await env.DB.prepare(`
    INSERT INTO notice_board (id, title, sections_json, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      sections_json = excluded.sections_json,
      updated_at = datetime('now')
  `)
		.bind(NOTICE_ROW_ID, normalized.title, JSON.stringify(normalized.sections))
		.run();
	await bumpContentVersion(env);

	const detail = await getNotice(env);
	if (!detail) throw new UserError("保存公告栏失败");

	return detail;
}

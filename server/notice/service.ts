import type { CloudflareEnv } from "../../types/env";
import type { NoticeBoard, NoticeBoardDetail } from "../../types/notice";
import { NOTICE_ROW_ID } from "./constants";
import { normalizeNoticeBoard, parseNoticePayload } from "./normalize";
import { UserError } from "../utils/userError";

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

export async function getNotice(
	env: CloudflareEnv,
): Promise<NoticeBoardDetail | null> {
	const row = await env.DB.prepare("SELECT * FROM notice_board WHERE id = ?")
		.bind(NOTICE_ROW_ID)
		.first<NoticeRecord>();

	if (!row) return null;

	return recordToDetail(row);
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

	const detail = await getNotice(env);
	if (!detail) throw new UserError("保存公告栏失败");

	return detail;
}

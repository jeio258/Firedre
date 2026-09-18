// 音乐解析业务逻辑（由 /api/music/url 路由编排调用）
// lx-host 依赖 import.meta.glob 必须留在 src 层，故本服务与 proxyCache 同居 src/lib
import { getSettingsGroup } from "@server/settings/service";
import { DEFAULT_LX_SCRIPT, getLxSource, LxError } from "@/lib/lx-host";
import type { CloudflareEnv } from "../../types/env";

export { LxError };

const RESOLVE_TIMEOUT_MS = 20_000;

export const SOURCES = new Set(["wy", "tx", "kw", "kg", "mg"]);
export const QUALITYS = new Set(["128k", "320k", "flac"]);

// 各平台 musicInfo 使用的 ID 字段
const ID_FIELD: Record<string, string> = {
	wy: "songmid",
	tx: "songmid",
	kw: "songmid",
	kg: "hash",
	mg: "copyrightId",
};

// 各平台 ID 格式（避免无效输入让音源空转重试至 CPU 超限）
const ID_PATTERN: Record<string, RegExp> = {
	kg: /^[A-Fa-f0-9]{32}$/, // 酷狗 FileHash
	tx: /^[A-Za-z0-9]+$/, // QQ 音乐 songmid
	wy: /^\d+$/, // 网易云歌曲 ID
};

// 从歌曲页/分享链接提取平台与歌曲 ID（支持 QQ 音乐、网易云）
export function extractSongFromLink(
	raw: string,
): { source: string; id: string } | null {
	try {
		const u = new URL(raw);
		const host = u.hostname.replace(/^www\./, "");
		// QQ 音乐：y.qq.com/n/ryqq/songDetail/{songmid}
		if (host === "y.qq.com" || host.endsWith("qq.com")) {
			const m =
				u.pathname.match(/songDetail\/([A-Za-z0-9]+)/) ??
				u.pathname.match(/song\/([A-Za-z0-9]+)\.html/);
			if (m) return { source: "tx", id: m[1] };
		}
		// 网易云：music.163.com/song?id={id} 或 /song/{id}
		if (host === "music.163.com" || host === "y.music.163.com") {
			const id = u.searchParams.get("id");
			const m = u.pathname.match(/\/song\/(\d+)/);
			if (id || m) return { source: "wy", id: (id || m) as string };
		}
	} catch {
		return null;
	}
	return null;
}

// ID 校验：缺失或格式不符时，若有歌名则自动搜索歌曲 ID（避免音源空转耗尽 CPU）
// 注：tx 的纯数字 ID 大概率是 songid 而非 songmid，同样触发搜索纠正
export function isTrackIdValid(
	source: string,
	id: string,
	name: string,
): { valid: boolean; needSearch: boolean } {
	const pattern = ID_PATTERN[source];
	const valid =
		!!id &&
		/^[A-Za-z0-9_-]+$/.test(id) &&
		(!pattern || pattern.test(id)) &&
		!(source === "tx" && /^\d+$/.test(id));
	if (valid) return { valid: true, needSearch: false };
	return { valid: false, needSearch: source === "tx" && !!name };
}

// QQ 音乐搜索：歌名+歌手 → songmid（id 缺失或格式不符时自动定位歌曲）
// 同时返回专辑封面 URL（albummid 拼接）
export async function searchTxSongmid(
	name: string,
	singer: string,
): Promise<{ songmid: string; pic: string } | null> {
	const q = encodeURIComponent(`${name} ${singer}`.trim());
	try {
		const res = await fetch(
			`https://c.y.qq.com/soso/fcgi-bin/client_search_cp?w=${q}&format=json`,
			{
				headers: {
					"user-agent": "Mozilla/5.0",
					referer: "https://y.qq.com/",
				},
				signal: AbortSignal.timeout(5000),
			},
		);
		if (!res.ok) return null;
		const data = (await res.json()) as {
			data?: {
				song?: {
					list?: Array<{
						songmid?: string;
						albummid?: string;
						songname?: string;
						singer?: Array<{ name?: string }>;
					}>;
				};
			};
		};
		const list = data?.data?.song?.list ?? [];
		const first = list[0];
		if (!first?.songmid) return null;
		// 优先精确匹配歌名（QQ 搜索可能返回同名不同版本或相关推荐，取错会导致歌不对）
		// 歌名相同时再优先匹配歌手，避免命中同名不同歌手的版本
		const norm = (v: string | undefined) =>
			(v ?? "").replace(/\s+/g, "").toLowerCase();
		const nameNorm = norm(name);
		const singerNorm = norm(singer);
		const byName = list.filter((x) => norm(x.songname) === nameNorm);
		const exact =
			byName.find((x) =>
				(x.singer ?? []).some((s) => norm(s?.name) === singerNorm),
			) ??
			byName[0] ??
			first;
		if (!exact?.songmid) return null;
		const pic = exact.albummid
			? `https://y.gtimg.cn/music/photo_new/T002R500x500M000${exact.albummid}.jpg`
			: "";
		return { songmid: exact.songmid, pic };
	} catch {
		return null;
	}
}

// 经 lx 音源解析播放链接：读后台 sourceScript 配置（失败回退默认），20s 超时
// 仅超时路径 abort 音源请求（abort 作用于实例全部 inflight，避免误伤同实例并发解析）
export async function resolveViaLx(opts: {
	env: CloudflareEnv;
	source: string;
	id: string;
	quality: string;
	name: string;
	singer: string;
}): Promise<string> {
	let scriptKey = DEFAULT_LX_SCRIPT;
	try {
		const music = await getSettingsGroup(opts.env, "music");
		if (typeof music.sourceScript === "string" && music.sourceScript) {
			scriptKey = music.sourceScript;
		}
	} catch {
		// 设置读取失败不影响解析
	}
	const lxSource = await getLxSource(scriptKey);
	let timeoutId: ReturnType<typeof setTimeout> | undefined;
	let timedOut = false;
	try {
		return await Promise.race([
			lxSource.getMusicUrl(
				opts.source,
				{
					[ID_FIELD[opts.source] ?? "id"]: opts.id,
					id: opts.id,
					name: opts.name,
					singer: opts.singer,
				},
				opts.quality,
			),
			new Promise<never>((_, reject) => {
				timeoutId = setTimeout(() => {
					timedOut = true;
					reject(new LxError("音源解析超时"));
				}, RESOLVE_TIMEOUT_MS);
			}),
		]);
	} finally {
		clearTimeout(timeoutId);
		if (timedOut) lxSource.abortInflight();
	}
}

import { getSettingsGroup } from "@server/settings/service";
import { withRateLimit } from "@server/utils/rateLimiter";
import type { APIRoute } from "astro";
import { badRequest, cfEnv, json } from "../../../lib/api";
import { DEFAULT_LX_SCRIPT, getLxSource, LxError } from "../../../lib/lx-host";

export const prerender = false;

const RESULT_TTL_S = 300;
const RESOLVE_TIMEOUT_MS = 20_000;

const SOURCES = new Set(["wy", "tx", "kw", "kg", "mg"]);
const QUALITYS = new Set(["128k", "320k", "flac"]);

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

const cachesRef = (globalThis as unknown as { caches?: CacheStorage }).caches;

// QQ 音乐搜索：歌名+歌手 → songmid（id 缺失或格式不符时自动定位歌曲）
// 同时返回专辑封面 URL（albummid 拼接）
async function searchTxSongmid(
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

// 从歌曲页/分享链接提取平台与歌曲 ID（支持 QQ 音乐、网易云）
function extractSongFromLink(
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

export const GET: APIRoute = async ({ url, request }) => {
	let source = url.searchParams.get("source") ?? "";
	let id = url.searchParams.get("id") ?? "";
	const quality = url.searchParams.get("quality") ?? "128k";
	const name = url.searchParams.get("name") ?? "";
	const singer = url.searchParams.get("singer") ?? "";
	let searchedPic = "";

	// 「歌曲 ID」可填歌曲页/分享链接：自动识别平台并提取歌曲 ID
	if (/^https?:\/\//.test(id)) {
		const extracted = extractSongFromLink(id);
		if (!extracted) {
			return badRequest(
				"无法从该链接识别歌曲（支持 QQ 音乐 / 网易云的歌曲页链接）",
			);
		}
		if (SOURCES.has(extracted.source)) source = extracted.source;
		id = extracted.id;
	}

	if (!SOURCES.has(source)) return badRequest("不支持的平台");
	if (!QUALITYS.has(quality)) return badRequest("不支持的音质");

	// ID 校验：缺失或格式不符时，若有歌名则自动搜索歌曲 ID（避免音源空转耗尽 CPU）
	// 注：tx 的纯数字 ID 大概率是 songid 而非 songmid，同样触发搜索纠正
	const pattern = ID_PATTERN[source];
	const idValid =
		!!id &&
		/^[A-Za-z0-9_-]+$/.test(id) &&
		(!pattern || pattern.test(id)) &&
		!(source === "tx" && /^\d+$/.test(id));
	if (!idValid) {
		if (source !== "tx" || !name) {
			return badRequest(
				id
					? "歌曲 ID 格式不合法（也可提供歌名与歌手以自动搜索）"
					: "缺少歌曲 ID（或提供歌名与歌手以自动搜索）",
			);
		}
		const found = await searchTxSongmid(name, singer);
		if (!found) {
			return badRequest(`未搜索到「${name} ${singer}」，请检查歌名与歌手`);
		}
		id = found.songmid;
		searchedPic = found.pic;
	}

	// 仅缓存成功结果；播放链接有时效，TTL 保持短
	const cacheKey = new Request(url.toString(), { method: "GET" });
	if (cachesRef) {
		const cached = await cachesRef.default.match(cacheKey);
		if (cached) {
			// cache.match 返回的 headers 不可变，外层 middleware 需追加安全头，需重建
			return new Response(cached.body, {
				status: cached.status,
				headers: cached.headers,
			});
		}
	}

	// 音源解析（高成本）：限流保护防止滥用触发多后端重试耗尽 CPU（缓存命中不计入）
	return withRateLimit(
		cfEnv,
		request,
		{ windowMs: 60_000, maxRequests: 30, scope: "music-url", failOpen: true },
		async () => {
			const t0 = Date.now();
			let timeoutId: ReturnType<typeof setTimeout> | undefined;
			let timedOut = false;
			try {
				// 音源脚本可后台配置（src/music-sources/ 内脚本按文件名选择），读取失败用默认
				let scriptKey = DEFAULT_LX_SCRIPT;
				try {
					const music = await getSettingsGroup(cfEnv, "music");
					if (typeof music.sourceScript === "string" && music.sourceScript) {
						scriptKey = music.sourceScript;
					}
				} catch {
					// 设置读取失败不影响解析
				}
				const lxSource = await getLxSource(scriptKey);
				try {
					const resolved = await Promise.race([
						lxSource.getMusicUrl(
							source,
							{ [ID_FIELD[source] ?? "id"]: id, id, name, singer },
							quality,
						),
						new Promise<never>((_, reject) => {
							timeoutId = setTimeout(() => {
								timedOut = true;
								reject(new LxError("音源解析超时"));
							}, RESOLVE_TIMEOUT_MS);
						}),
					]);

					console.log(
						`[music/url] ok source=${source} quality=${quality} 耗时=${Date.now() - t0}ms`,
					);
					const response = json(
						{
							ok: true,
							url: resolved,
							source,
							quality,
							name,
							singer,
							...(searchedPic ? { pic: searchedPic } : {}),
						},
						200,
					);
					response.headers.set(
						"cache-control",
						`public, max-age=${RESULT_TTL_S}`,
					);
					if (cachesRef) {
						try {
							await cachesRef.default.put(cacheKey, response.clone());
						} catch {
							// 缓存写入失败不影响返回
						}
					}
					return response;
				} finally {
					clearTimeout(timeoutId);
					// 仅超时路径取消音源网络请求：abort 作用于实例全部 inflight，
					// 成功/失败路径调用会误伤同实例的其他并发解析
					if (timedOut) lxSource.abortInflight();
				}
			} catch (error) {
				const detail = error instanceof Error ? error.message : String(error);
				console.error("[music/url] 解析失败:", detail);
				const message =
					error instanceof LxError ? error.message : `音源解析失败：${detail}`;
				// 失败结果不缓存，便于上游恢复后立即生效
				return json({ ok: false, message }, 502);
			}
		},
	);
};

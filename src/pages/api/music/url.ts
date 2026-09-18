import { withRateLimit } from "@server/utils/rateLimiter";
import type { APIRoute } from "astro";
import { badRequest, cfEnv, json } from "@/lib/api";
import {
	extractSongFromLink,
	isTrackIdValid,
	LxError,
	QUALITYS,
	resolveViaLx,
	SOURCES,
	searchTxSongmid,
} from "@/lib/music-service";

export const prerender = false;

const RESULT_TTL_S = 300;

const cachesRef = (globalThis as unknown as { caches?: CacheStorage }).caches;

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

	const { valid, needSearch } = isTrackIdValid(source, id, name);
	if (!valid) {
		if (!needSearch) {
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
			try {
				const resolved = await resolveViaLx({
					env: cfEnv,
					source,
					id,
					quality,
					name,
					singer,
				});

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

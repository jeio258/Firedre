import type { APIRoute } from "astro";
import { badRequest, json } from "../../../lib/api";
import { getLxSource, LxError } from "../../../lib/lx-host";

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

export const GET: APIRoute = async ({ url }) => {
	const source = url.searchParams.get("source") ?? "";
	const id = url.searchParams.get("id") ?? "";
	const quality = url.searchParams.get("quality") ?? "128k";
	const name = url.searchParams.get("name") ?? "";
	const singer = url.searchParams.get("singer") ?? "";

	if (!SOURCES.has(source)) return badRequest("不支持的平台");
	if (!id) return badRequest("缺少歌曲 ID");
	if (!QUALITYS.has(quality)) return badRequest("不支持的音质");
	// 格式校验：不合格直接拒绝，避免音源逐后端重试耗尽 CPU 时间
	if (!/^[A-Za-z0-9_-]+$/.test(id)) return badRequest("歌曲 ID 格式不合法");
	const pattern = ID_PATTERN[source];
	if (pattern && !pattern.test(id)) {
		return badRequest(
			source === "kg"
				? "酷狗歌曲标识应为 32 位十六进制 FileHash"
				: `歌曲 ID 格式不合法（${source}）`,
		);
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

	try {
		const lxSource = await getLxSource();
		const resolved = await Promise.race([
			lxSource.getMusicUrl(
				source,
				{ [ID_FIELD[source] ?? "id"]: id, id, name, singer },
				quality,
			),
			new Promise<never>((_, reject) =>
				setTimeout(
					() => reject(new LxError("音源解析超时")),
					RESOLVE_TIMEOUT_MS,
				),
			),
		]);

		const response = json(
			{ ok: true, url: resolved, source, quality, name, singer },
			200,
		);
		response.headers.set("cache-control", `public, max-age=${RESULT_TTL_S}`);
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
};

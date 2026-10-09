// 第三方代理共享：轻量内存限流 + 响应缓存（prod caches.default / dev 跳过）

import { getClientIp } from "@server/utils/clientIp";
import { pruneBoundedMap } from "@shared/utils/bounded-map";

const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 60_000;
const CACHE_TTL_SEC = 300;
// 限流桶上限：超限时清理过期项/整体清空，防长驻 isolate 内存无界增长
const RATE_BUCKETS_MAX = 5000;

// 单实例内尽力限流：per-IP 滑动窗口，超出返回 true（应拒绝）
// 存于 globalThis：dev 下模块可能按请求重新求值，globalThis 跨请求保留状态
const g = globalThis as unknown as {
	__proxyRateBuckets?: Map<string, { count: number; resetAt: number }>;
};
g.__proxyRateBuckets ??= new Map();
const buckets: Map<string, { count: number; resetAt: number }> =
	g.__proxyRateBuckets;

function proxyRateLimited(request: Request): boolean {
	// IP 口径与 server/utils/clientIp 统一（CF-Connecting-IP 单源）
	const ip = getClientIp(request);
	const now = Date.now();
	pruneBoundedMap(buckets, now, RATE_BUCKETS_MAX);
	const b = buckets.get(ip);
	if (!b || b.resetAt <= now) {
		buckets.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
		return false;
	}
	b.count += 1;
	if (b.count > RATE_LIMIT_MAX) return true;
	return false;
}

function cacheKey(url: URL): string {
	return `${url.origin}${url.pathname}${url.search}`;
}

async function proxyCacheGet(url: URL): Promise<Response | null> {
	if (import.meta.env.DEV) return null;
	try {
		const cached = await caches.default.match(cacheKey(url));
		return cached ?? null;
	} catch {
		return null;
	}
}

// 仅成功响应可入缓存：把 4xx/5xx（配置缺失、上游错误）缓存 300s 会把故障固化数分钟，
// 修复配置或上游恢复后仍返回旧的错误响应。
export function isCacheableResponse(response: Response): boolean {
	return response.status >= 200 && response.status < 300;
}

// 存储副本要用边缘 TTL（public,max-age）才会被 Cache API 保存；但 handler 原意的浏览器
// 缓存头（如 json(...,"private") 的 private,no-store）不能丢——否则命中时被改成 public，
// 会让浏览器缓存本不该缓存的内容，且 MISS/HIT 语义不一致。故把原 Cache-Control 另存于
// 内部头，命中回放时还原（见 buildHitHeaders）。
const ORIGIN_CC_HEADER = "X-Firedre-Origin-Cache-Control";

export function buildStoredHeaders(originHeaders: Headers): Headers {
	const headers = new Headers(originHeaders);
	const originCC = originHeaders.get("Cache-Control");
	if (originCC) headers.set(ORIGIN_CC_HEADER, originCC);
	headers.set("Cache-Control", `public, max-age=${CACHE_TTL_SEC}`);
	headers.set("X-Firedre-Cache", "MISS");
	return headers;
}

export function buildHitHeaders(cachedHeaders: Headers): Headers {
	const headers = new Headers(cachedHeaders);
	const originCC = headers.get(ORIGIN_CC_HEADER);
	headers.delete(ORIGIN_CC_HEADER);
	if (originCC) headers.set("Cache-Control", originCC);
	headers.set("X-Firedre-Cache", "HIT");
	return headers;
}

async function proxyCachePut(url: URL, response: Response): Promise<void> {
	if (import.meta.env.DEV) return;
	if (!isCacheableResponse(response)) return;
	try {
		await caches.default.put(
			cacheKey(url),
			new Response(response.body, {
				status: response.status,
				headers: buildStoredHeaders(response.headers),
			}),
		);
	} catch {
		// 缓存写入失败不影响主流程
	}
}

// 代理路由共用前置守卫：限流命中返回 429，缓存命中回放响应，均未命中返回 null
// proxyCacheGet 自身已在 DEV 短路，调用方无需再判断环境
async function proxyEarlyResponse(
	request: Request,
	url: URL,
): Promise<Response | null> {
	if (proxyRateLimited(request)) {
		return new Response(JSON.stringify({ error: "请求过于频繁，请稍后再试" }), {
			status: 429,
			headers: { "Content-Type": "application/json" },
		});
	}

	const cached = await proxyCacheGet(url);
	if (!cached) return null;

	return new Response(await cached.text(), {
		status: cached.status,
		headers: buildHitHeaders(cached.headers),
	});
}

// 三段式代理路由的公共包装：early（限流/缓存命中）→ 业务 handler → 结果回填缓存
// handler 抛错交由调用方的 try/catch 处理（serverError）
export async function withProxyGuard<T extends Response>(
	request: Request,
	url: URL,
	handler: () => Promise<T>,
): Promise<Response> {
	const early = await proxyEarlyResponse(request, url);
	if (early) return early;
	const body = await handler();
	await proxyCachePut(url, body.clone());
	return body;
}

// 第三方代理共享：轻量内存限流 + 响应缓存（prod caches.default / dev 跳过）

function getRequestClientIp(request: Request): string {
	return (
		request.headers.get("CF-Connecting-IP") ||
		request.headers.get("X-Real-IP") ||
		request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
		"unknown"
	);
}

const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 60_000;
const CACHE_TTL_SEC = 300;

// 单实例内尽力限流：per-IP 滑动窗口，超出返回 true（应拒绝）
// 存于 globalThis：dev 下模块可能按请求重新求值，globalThis 跨请求保留状态
const g = globalThis as unknown as { __proxyRateBuckets?: Map<string, { count: number; resetAt: number }> };
const buckets: Map<string, { count: number; resetAt: number }> =
	g.__proxyRateBuckets ?? (g.__proxyRateBuckets = new Map());

export function proxyRateLimited(request: Request): boolean {
	const ip = getRequestClientIp(request);
	const now = Date.now();
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

export async function proxyCacheGet(url: URL): Promise<Response | null> {
	if (import.meta.env.DEV) return null;
	try {
		const cached = await caches.default.match(cacheKey(url));
		return cached ?? null;
	} catch {
		return null;
	}
}

export async function proxyCachePut(url: URL, response: Response): Promise<void> {
	if (import.meta.env.DEV) return;
	try {
		const headers = new Headers(response.headers);
		headers.set("Cache-Control", `public, max-age=${CACHE_TTL_SEC}`);
		headers.set("X-Firedre-Cache", "MISS");
		await caches.default.put(
			cacheKey(url),
			new Response(response.body, { status: response.status, headers }),
		);
	} catch {
		// 缓存写入失败不影响主流程
	}
}

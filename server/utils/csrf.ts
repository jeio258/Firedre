/**
 * 写请求同源校验（CSRF 纵深防御）。
 * 第一道是会话 Cookie 的 SameSite=Lax；本模块是第二道，供中间件对 /api/ 写操作统一调用。
 */

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * 非安全方法同源判定：
 * - 带 Origin：须与请求同源（Origin: "null" 不可信，继续看 Sec-Fetch-Site）
 * - 无 Origin：Sec-Fetch-Site 为跨站则拒绝
 * - 两者皆无：非浏览器客户端（无 Cookie 可被冒用），放行
 */
export function isSameOriginRequest(request: Request): boolean {
	const method = request.method.toUpperCase();
	if (SAFE_METHODS.has(method)) return true;

	const origin = request.headers.get("Origin");
	if (origin && origin !== "null") {
		try {
			return new URL(origin).origin === new URL(request.url).origin;
		} catch {
			return false;
		}
	}

	const site = request.headers.get("Sec-Fetch-Site");
	if (site && site !== "same-origin" && site !== "none") return false;

	return true;
}

export function originForbiddenResponse(): Response {
	return new Response(JSON.stringify({ message: "跨站请求被拒绝" }), {
		status: 403,
		headers: {
			"Content-Type": "application/json; charset=utf-8",
			"Cache-Control": "no-store",
		},
	});
}

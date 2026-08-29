/**
 * 请求去重工具
 * 避免同页面多个组件重复请求同一接口
 */

const pendingFetches = new Map<string, Promise<unknown>>();

/**
 * 将相对路径转为绝对 URL（仅 SSR 需要）。
 * Cloudflare Worker（workerd）的 fetch 不接受相对 URL（会抛 `Invalid URL`），
 * 而浏览器（客户端）可以。因此仅在 SSR 环境（import.meta.env.SSR）下拼接绝对 origin。
 *
 * origin 取当前请求的 origin（middleware 注入的全局 __FIREFLY_ORIGIN__）；
 * 回退到 import.meta.env.SITE（Astro 注入的 site 配置），最后回退 localhost。
 */
function resolveFetchUrl(url: string): string {
	if (!import.meta.env.SSR) return url;
	// 已是绝对 URL 则原样返回
	if (/^https?:\/\//i.test(url)) return url;
	const origin =
		(globalThis as unknown as { __FIREFLY_ORIGIN__?: string }).__FIREFLY_ORIGIN__ ||
		import.meta.env.SITE ||
		"http://localhost";
	const base = origin.replace(/\/$/, "");
	return url.startsWith("/") ? `${base}${url}` : `${base}/${url}`;
}

export function fetchWithDedup<T>(url: string): Promise<T> {
	const pending = pendingFetches.get(url);
	if (pending) return pending as Promise<T>;

	const promise = fetch(resolveFetchUrl(url)).then((r) => {
		if (!r.ok) throw new Error("Failed to fetch");
		return r.json() as Promise<T>;
	});
	pendingFetches.set(url, promise);
	promise.finally(() => pendingFetches.delete(url));
	return promise;
}

import { getCached, setCached } from "./adminViewCache";

export interface ApiError extends Error {
	status?: number;
}

export async function apiJson<T = unknown>(
	url: string,
	init?: RequestInit,
): Promise<T> {
	const resp = await fetch(url, {
		credentials: "include",
		...init,
		// 弱网下避免请求永久挂起（保存按钮无法恢复）；调用方显式传入 signal 时不覆盖
		signal: init?.signal ?? AbortSignal.timeout(30_000),
	});
	const data = (await resp.json().catch(() => null)) as
		| (T & { ok?: boolean; message?: string })
		| null;
	const message =
		data && typeof data === "object" && "message" in data
			? (data as { message?: string }).message
			: null;
	if (!resp.ok || (data && typeof data === "object" && data.ok === false)) {
		const err = new Error(
			message || resp.statusText || String(resp.status),
		) as ApiError;
		err.status = resp.status;
		throw err;
	}
	return data as T;
}

/** 只用于 GET 读取：命中缓存不发请求，未命中请求成功后回填；失败一律不入缓存 */
export async function apiJsonCached<T = unknown>(
	url: string,
	options: { key?: string; ttl?: number } = {},
): Promise<T> {
	const key = options.key ?? url;
	const hit = getCached<T>(key);
	if (hit !== undefined) return hit;
	const data = await apiJson<T>(url);
	setCached(key, data, options.ttl);
	return data;
}

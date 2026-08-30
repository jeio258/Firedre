/**
 * 后台 API 请求统一封装：固定带鉴权 cookie，自动解析 JSON，非 2xx 抛出含服务端 message 的错误。
 * 后台各组件原本各自写 fetch + credentials:"include" + resp.ok 判断，这里收敛为单一入口，
 * 既消除重复，也保证鉴权策略（credentials）与错误处理只在一处维护。
 */
export async function apiJson<T = unknown>(
	url: string,
	init?: RequestInit,
): Promise<T> {
	const resp = await fetch(url, {
		credentials: "include",
		...init,
	});
	const data = (await resp.json().catch(() => null)) as
		| (T & { message?: string })
		| null;
	if (!resp.ok) {
		const msg =
			(data && typeof data === "object" && "message" in data
				? (data as { message?: string }).message
				: null) ||
			resp.statusText ||
			String(resp.status);
		throw new Error(msg);
	}
	return data as T;
}

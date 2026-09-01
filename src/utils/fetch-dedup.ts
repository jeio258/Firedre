

const pendingFetches = new Map<string, Promise<unknown>>();

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

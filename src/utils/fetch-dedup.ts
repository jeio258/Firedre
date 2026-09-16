

const pendingByKey = new Map<string, Promise<unknown>>();

/** 并发同 key 共享同一 Promise；串行调用不去重（与既有 fetch 去重语义一致） */
export function dedupByKey<T>(
	key: string,
	factory: () => Promise<T>,
): Promise<T> {
	const pending = pendingByKey.get(key);
	if (pending) return pending as Promise<T>;

	const promise = factory();
	pendingByKey.set(key, promise);
	const cleanup = () => pendingByKey.delete(key);
	promise.then(cleanup, cleanup);
	return promise;
}

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
	return dedupByKey(url, () =>
		fetch(resolveFetchUrl(url)).then((r) => {
			if (!r.ok) throw new Error("Failed to fetch");
			return r.json() as Promise<T>;
		}),
	);
}

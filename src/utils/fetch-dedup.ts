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

export function fetchWithDedup<T>(url: string): Promise<T> {
	return dedupByKey(url, () =>
		fetch(url).then((r) => {
			if (!r.ok) throw new Error("Failed to fetch");
			return r.json() as Promise<T>;
		}),
	);
}

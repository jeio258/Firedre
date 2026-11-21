// Cache API 读写样板。
// 原先每个使用点各自写一遍 typeof caches 判断 / try-catch / JSON 包装，
// 键格式与 TTL 语义由调用方决定，这里只消除重复样板。

/** 读失败、无缓存环境、校验不通过一律返回 null（缓存不可用不得影响主流程）。 */
export async function edgeCacheGet<T>(
	key: string,
	validate?: (value: unknown) => value is T,
): Promise<T | null> {
	if (typeof caches === "undefined") return null;
	try {
		const hit = await caches.default.match(key);
		if (!hit) return null;
		const data: unknown = await hit.json();
		if (validate && !validate(data)) return null;
		return data as T;
	} catch {
		return null;
	}
}

/** cacheControl 直接决定边缘 TTL，与各调用点原有取值保持一致。 */
export async function edgeCacheSet(
	key: string,
	data: unknown,
	cacheControl: string,
): Promise<void> {
	if (typeof caches === "undefined") return;
	try {
		await caches.default.put(
			key,
			new Response(JSON.stringify(data), {
				headers: {
					"Content-Type": "application/json",
					"Cache-Control": cacheControl,
				},
			}),
		);
	} catch {}
}

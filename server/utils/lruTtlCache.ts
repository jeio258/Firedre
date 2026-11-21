// 通用 LRU + TTL 内存缓存。
// 站点内曾有三份各写各的实现（文章渲染 L1、通用渲染 L1、设置元数据 L1），
// 行为差异仅在容量与 TTL，这里统一为一份，避免再各改各的。
export interface LruTtlCache<T> {
	get(key: string): T | undefined;
	set(key: string, value: T): void;
}

/** ttlMs <= 0 表示不过期（依赖键本身含内容版本）。 */
export function createLruTtlCache<T>(
	maxEntries: number,
	ttlMs = 0,
): LruTtlCache<T> {
	const store = new Map<string, { value: T; expires: number }>();
	return {
		get(key) {
			const hit = store.get(key);
			if (!hit) return undefined;
			if (ttlMs > 0 && Date.now() > hit.expires) {
				store.delete(key);
				return undefined;
			}
			// 命中即移到队尾，保持 LRU 顺序
			store.delete(key);
			store.set(key, hit);
			return hit.value;
		},
		set(key, value) {
			store.delete(key);
			store.set(key, {
				value,
				expires: ttlMs > 0 ? Date.now() + ttlMs : 0,
			});
			if (store.size > maxEntries) {
				const oldest = store.keys().next().value;
				if (oldest !== undefined) store.delete(oldest);
			}
		},
	};
}

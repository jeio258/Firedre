// 后台视图数据的内存缓存：切回已看过的菜单时跳过接口往返（跨区 D1 单次 0.3–0.6s）
type Entry = { at: number; ttl: number; data: unknown };

const DEFAULT_TTL = 30_000;
const MAX_ENTRIES = 20;
const store = new Map<string, Entry>();

function evict() {
	while (store.size > MAX_ENTRIES) {
		const oldest = store.keys().next();
		if (oldest.done) return;
		store.delete(oldest.value);
	}
}

export function getCached<T = unknown>(key: string): T | undefined {
	const hit = store.get(key);
	if (!hit) return undefined;
	if (Date.now() - hit.at >= hit.ttl) {
		store.delete(key);
		return undefined;
	}
	// 命中后移到队尾，Map 插入顺序即淘汰顺序
	store.delete(key);
	store.set(key, hit);
	return hit.data as T;
}

export function setCached(key: string, data: unknown, ttl = DEFAULT_TTL): void {
	store.delete(key);
	store.set(key, { at: Date.now(), ttl, data });
	evict();
}

/** 不带 prefix 清空全部；带 prefix 只清键前缀匹配项（写操作后调用） */
export function invalidate(prefix?: string): void {
	if (prefix === undefined) {
		store.clear();
		return;
	}
	for (const key of [...store.keys()]) {
		if (key.startsWith(prefix)) store.delete(key);
	}
}

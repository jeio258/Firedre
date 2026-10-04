// isolate/进程级缓存：globalThis 存储（跨请求存活）、以版本为键 + TTL 兜底。
// 统一 middleware 设置缓存 / settings-client / allPostMeta 三处同构实现，
// 避免各自维护 TTL 与失效语义导致漂移。

interface CacheEntry<T> {
	version: string;
	value: T;
	at: number;
}

const SLOT = "__FIREDRE_ISOLATE_CACHES__";

/** 统一 TTL：设置/内容类缓存的默认过期（版本号命中时仍以版本为准确依据） */
export const ISOLATE_CACHE_TTL_MS = 30_000;

function cacheStore(): Record<string, CacheEntry<unknown>> {
	const g = globalThis as unknown as Record<
		string,
		Record<string, CacheEntry<unknown>>
	>;
	g[SLOT] ??= {};
	return g[SLOT];
}

/** 版本命中且未过期 → 返回值；否则 undefined（miss） */
export function readIsolateCache<T>(
	slot: string,
	version: string,
	ttlMs: number = ISOLATE_CACHE_TTL_MS,
): T | undefined {
	const entry = cacheStore()[slot] as CacheEntry<T> | undefined;
	if (entry && entry.version === version && Date.now() - entry.at < ttlMs) {
		return entry.value;
	}
	return undefined;
}

export function writeIsolateCache<T>(
	slot: string,
	version: string,
	value: T,
): void {
	cacheStore()[slot] = { version, value, at: Date.now() };
}

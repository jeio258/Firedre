/**
 * cloudflare:workers 运行时模块的类型声明（宽松类型，避免引入 workers-types 全局污染 src）。
 * caches 为 Cloudflare Workers Cache API：caches.default 是默认命名缓存。
 */
declare module "cloudflare:workers" {
	export interface CacheMatchOptions {
		ignoreMethod?: boolean;
		ignoreSearch?: boolean;
		ignoreVary?: boolean;
	}
	export interface CachePutOptions {
		methods?: string[];
	}
	export interface Cache {
		match(
			request: RequestInfo | URL,
			options?: CacheMatchOptions,
		): Promise<Response | undefined>;
		put(
			request: RequestInfo | URL,
			response: Response,
			options?: CachePutOptions,
		): Promise<void>;
	}
	export interface CacheStorage {
		readonly default: Cache;
		open(cacheName: string): Promise<Cache>;
	}
	export const env: Record<string, any>;
	export const context: unknown;
	export const caches: CacheStorage;
}

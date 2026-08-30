/**
 * cloudflare:workers 运行时模块的类型声明（宽松类型，避免引入 workers-types 全局污染 src）。
 */
declare module "cloudflare:workers" {
	export const env: Record<string, any>;
	export const context: unknown;
	export const caches: unknown;
}

/**
 * Cloudflare Workers Cache API：caches.default 是默认命名缓存。
 * 通过扩充 DOM 的 CacheStorage 接口补充 .default 属性（生产 workerd 提供全局 caches）；
 * astro dev 下 caches.default 可能不存在 → middleware 以 try/catch 兜底。
 */
interface CacheStorage {
	readonly default: {
		match(request: RequestInfo | URL): Promise<Response | undefined>;
		put(request: RequestInfo | URL, response: Response): Promise<void>;
	};
}

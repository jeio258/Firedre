
declare module "cloudflare:workers" {
	export const env: Record<string, any>;
	export const context: unknown;
	export const caches: unknown;
}

interface CacheStorage {
	readonly default: {
		match(request: RequestInfo | URL): Promise<Response | undefined>;
		put(request: RequestInfo | URL, response: Response): Promise<void>;
	};
}

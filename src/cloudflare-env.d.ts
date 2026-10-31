declare module "cloudflare:workers" {
	// 类型只能内联导入：本文件必须保持全局脚本形态，否则下方 declare module 会退化为模块增强
	export const env: import("../types/env").CloudflareEnv;
	export const context: unknown;
	export const caches: unknown;
}

// 与 types/ambient.d.ts 的同名声明保持同签名：两份分别服务 astro check（含 src）与
// tsc -p tsconfig.server（含 types），签名不一致会在两套配置间产生行为差异
interface CacheStorage {
	readonly default: {
		match(request: string | Request): Promise<Response | undefined>;
		put(request: string | Request, response: Response): Promise<void>;
		delete(request: string | Request): Promise<boolean>;
	};
}

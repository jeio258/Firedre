/**
 * cloudflare:workers 运行时模块的类型声明（宽松类型，避免引入 workers-types 全局污染 src）
 */
declare module "cloudflare:workers" {
	export const env: Record<string, any>;
	export const context: unknown;
	export const caches: unknown;
}

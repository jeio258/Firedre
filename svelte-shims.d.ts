// 仅供 svelte-check 解析 server/*.ts 导入时使用的最小 D1 类型
// （不加载整套 @cloudflare/workers-types，避免其与 lib.dom 的全局冲突；
//   astro check 走 Astro 集成自带类型，本文件在根级、未被主 tsconfig include）
interface D1Result<T = unknown> {
	results: T[];
	success: boolean;
	meta?: Record<string, unknown>;
}
interface D1PreparedStatement {
	bind(...values: unknown[]): D1PreparedStatement;
	first<T = unknown>(): Promise<T | null>;
	all<T = unknown>(): Promise<D1Result<T>>;
	get<T = unknown>(): Promise<T | null>;
	run(): Promise<D1Result>;
	raw<T = unknown>(): Promise<T[]>;
}
interface D1Database {
	prepare(query: string): D1PreparedStatement;
	batch<T = unknown>(...statements: unknown[]): Promise<D1Result<T>[]>;
	exec(sql: string): Promise<unknown>;
	dump(): Promise<unknown>;
}

// 仅供 svelte-check 解析 server/*.ts 导入时使用的最小 D1 类型
// （不加载整套 @cloudflare/workers-types，避免其与 lib.dom 的全局冲突；
//   astro check 走 Astro 集成自带类型，本文件在根级、未被主 tsconfig include）
interface D1Result<T = unknown> {
	results: T[];
	success: boolean;
	meta?: {
		changes?: number;
		last_row_id?: number;
		duration?: number;
		rows_read?: number;
		rows_written?: number;
		[K: string]: unknown;
	};
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

// R2 最小类型（服务端 R2 读写被 svelte 组件间接引用；get 仅返回可读对象）
interface R2Object {
	key: string;
	size: number;
	etag: string;
	httpEtag: string;
	uploaded: Date;
	writeHttpMetadata(headers: Headers): void;
	[K: string]: unknown;
}
interface R2ObjectBody extends R2Object {
	body: ReadableStream<Uint8Array>;
	text(): Promise<string>;
	json<T = unknown>(): Promise<T>;
	arrayBuffer(): Promise<ArrayBuffer>;
}
interface R2Bucket {
	put(
		key: string,
		value: ReadableStream | ArrayBuffer | string,
		options?: unknown,
	): Promise<R2Object>;
	get(key: string, options?: unknown): Promise<R2ObjectBody | null>;
	delete(key: string): Promise<void>;
	list(
		options?: unknown,
	): Promise<{ objects: R2Object[]; truncated: boolean; cursor?: string }>;
}

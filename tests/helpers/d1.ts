import type { DatabaseSync } from "node:sqlite";

export interface D1Like {
	prepare(sql: string): D1StmtLike;
}

export interface D1StmtLike {
	bind(...args: unknown[]): D1StmtLike;
	run(): Promise<{
		success: boolean;
		meta: { changes: number; last_row_id: number };
	}>;
	first<T = Record<string, unknown>>(): Promise<T | null>;
	all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
}

/** node:sqlite 之上的 D1 兼容桩：run() 返回 D1Result 形状的 meta.changes */
export function makeD1(db: DatabaseSync): D1Like {
	return {
		prepare(sql: string) {
			const stmt = db.prepare(sql);
			let args: unknown[] = [];
			const chain: D1StmtLike = {
				bind(...more: unknown[]) {
					args = [...args, ...more];
					return chain;
				},
				async run() {
					const info = stmt.run(...(args as never[])) as {
						changes?: number | bigint;
						lastInsertRowid?: number | bigint;
					};
					return {
						success: true,
						meta: {
							changes: Number(info.changes ?? 0),
							last_row_id: Number(info.lastInsertRowid ?? 0),
						},
					};
				},
				async first<T = Record<string, unknown>>() {
					return (stmt.get(...(args as never[])) as T | undefined) ?? null;
				},
				async all<T = Record<string, unknown>>() {
					return { results: stmt.all(...(args as never[])) as T[] };
				},
			};
			return chain;
		},
	};
}

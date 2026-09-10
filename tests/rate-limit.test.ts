import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
	LOGIN_MAX_ATTEMPTS,
	createD1LoginRateLimit,
} from "../server/auth/loginRateLimit";
import { checkD1RateLimit } from "../server/utils/rateLimiter";

function makeD1(db: DatabaseSync): D1Database {
	return {
		prepare(sql: string) {
			const stmt = db.prepare(sql);
			let args: unknown[] = [];
			const chain = {
				bind(...more: unknown[]) {
					args = [...args, ...more];
					return chain;
				},
				async run() {
					const info = stmt.run(...(args as never[])) as {
						changes?: number | bigint;
					};
					return {
						success: true,
						meta: { changes: Number(info.changes ?? 0) },
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
	} as unknown as D1Database;
}

let db: DatabaseSync;

beforeAll(() => {
	db = new DatabaseSync(":memory:");
	const migDir = join(process.cwd(), "migrations");
	const files = readdirSync(migDir)
		.filter((f) => f.endsWith(".sql"))
		.sort();
	for (const file of files) {
		db.exec(readFileSync(join(migDir, file), "utf8"));
	}
});

beforeEach(() => {
	db.exec("DELETE FROM rate_limits");
});

describe("checkD1RateLimit 原子窗口限流", () => {
	it("达到上限前放行，第 max+1 次拒绝", async () => {
		const d1 = makeD1(db);
		const cfg = { windowMs: 60_000, maxRequests: 3 };
		expect((await checkD1RateLimit(d1, "k", cfg)).allowed).toBe(true);
		expect((await checkD1RateLimit(d1, "k", cfg)).allowed).toBe(true);
		expect((await checkD1RateLimit(d1, "k", cfg)).allowed).toBe(true);
		const denied = await checkD1RateLimit(d1, "k", cfg);
		expect(denied.allowed).toBe(false);
		expect(denied.retryAfterSec).toBeGreaterThan(0);
	});

	it("窗口滚动后重新放行且计数归位", async () => {
		const d1 = makeD1(db);
		const cfg = { windowMs: 60_000, maxRequests: 2 };
		await checkD1RateLimit(d1, "k", cfg);
		await checkD1RateLimit(d1, "k", cfg);
		expect((await checkD1RateLimit(d1, "k", cfg)).allowed).toBe(false);
		db.prepare(
			"UPDATE rate_limits SET window_started_at = window_started_at - ? WHERE key = 'k'",
		).run(cfg.windowMs);
		expect((await checkD1RateLimit(d1, "k", cfg)).allowed).toBe(true);
	});
});

describe("loginRateLimit 原子失败计数", () => {
	it("累计达到上限后锁定", async () => {
		const store = createD1LoginRateLimit(makeD1(db));
		for (let i = 0; i < LOGIN_MAX_ATTEMPTS - 1; i++) {
			await store.recordFailure("1.1.1.1");
		}
		expect((await store.check("1.1.1.1")).allowed).toBe(true);
		await store.recordFailure("1.1.1.1");
		const after = await store.check("1.1.1.1");
		expect(after.allowed).toBe(false);
		expect(after.retryAfterSec).toBeGreaterThan(0);
	});
});

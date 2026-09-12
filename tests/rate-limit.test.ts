import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { DatabaseSync } from "node:sqlite";
import {
	LOGIN_MAX_ATTEMPTS,
	createD1LoginRateLimit,
} from "../server/auth/loginRateLimit";
import { checkD1RateLimit } from "../server/utils/rateLimiter";
import { makeD1 } from "./helpers/d1";
import { applyMigrations } from "./helpers/migrations";

let db: DatabaseSync;

beforeAll(() => {
	db = new DatabaseSync(":memory:");
	applyMigrations(db);
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

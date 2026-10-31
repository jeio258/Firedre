import { DatabaseSync } from "node:sqlite";
import { beforeAll, describe, expect, it } from "vitest";
import {
	createD1LoginRateLimit,
	LOGIN_MAX_ATTEMPTS,
} from "../server/auth/loginRateLimit";
import { makeD1 } from "./helpers/d1";
import { applyMigrations } from "./helpers/migrations";

let store: ReturnType<typeof createD1LoginRateLimit>;

beforeAll(() => {
	const db = new DatabaseSync(":memory:");
	applyMigrations(db);
	store = createD1LoginRateLimit(makeD1(db) as never);
});

describe("登录限流原子锁定（#1）", () => {
	it("达到阈值的那次失败即返回 locked=true", async () => {
		const ip = "10.9.0.1";
		let last: { locked: boolean; retryAfterSec: number } | null = null;
		for (let i = 0; i < LOGIN_MAX_ATTEMPTS; i++) {
			last = await store.recordFailure(ip);
		}
		expect(last?.locked).toBe(true);
		expect(last?.retryAfterSec).toBeGreaterThan(0);
		expect((await store.check(ip)).allowed).toBe(false);
	});

	it("未达阈值不锁定", async () => {
		const r = await store.recordFailure("10.9.0.2");
		expect(r.locked).toBe(false);
		expect((await store.check("10.9.0.2")).allowed).toBe(true);
	});

	it("clear 后解除锁定", async () => {
		const ip = "10.9.0.3";
		for (let i = 0; i < LOGIN_MAX_ATTEMPTS; i++) await store.recordFailure(ip);
		expect((await store.check(ip)).allowed).toBe(false);
		await store.clear(ip);
		expect((await store.check(ip)).allowed).toBe(true);
	});
});

import { describe, it, expect } from "vitest";
import { UserError } from "../server/utils/userError";
import { checkD1RateLimit } from "../server/utils/rateLimiter";

describe("UserError", () => {
	it("is an Error subclass with name UserError", () => {
		const err = new UserError("中文提示");
		expect(err).toBeInstanceOf(Error);
		expect(err.name).toBe("UserError");
		expect(err.message).toBe("中文提示");
	});

	it("is distinguishable from a plain Error via instanceof", () => {
		expect(new UserError("x") instanceof UserError).toBe(true);
		expect(new Error("x") instanceof UserError).toBe(false);
	});
});

describe("checkD1RateLimit fail-open/fail-closed", () => {
	// 模拟 D1 故障：prepare 抛错
	function failingDb(): D1Database {
		return {
			prepare() {
				throw new Error("D1 down");
			},
		} as unknown as D1Database;
	}

	it("defaults to fail-open (allowed) on D1 failure", async () => {
		const result = await checkD1RateLimit(
			failingDb(),
			"key",
			{ windowMs: 60_000, maxRequests: 10 },
		);
		expect(result.allowed).toBe(true);
	});

	it("fails closed (denied) when failOpen=false on D1 failure", async () => {
		const result = await checkD1RateLimit(
			failingDb(),
			"key",
			{ windowMs: 60_000, maxRequests: 10, failOpen: false },
		);
		expect(result.allowed).toBe(false);
		expect(result.retryAfterSec).toBeGreaterThan(0);
	});
});

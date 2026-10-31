import { describe, expect, it } from "vitest";
import {
	checkMemoryRateLimit,
	MEMORY_STORE_MAX,
} from "../server/utils/rateLimiter";

describe("checkMemoryRateLimit 内存有界（P9）", () => {
	it("超过上限触发清理 → 早期 key 被重置（不再无界增长）", () => {
		const cfg = { windowMs: 60_000, maxRequests: 5 };
		// 填超过上限：应触发清理（无过期项则整体清空）
		for (let i = 0; i <= MEMORY_STORE_MAX; i++) {
			checkMemoryRateLimit(`bound.k${i}`, cfg);
		}
		// 早期 key 已被清理 → 再次访问视为新窗口（remaining = max-1）
		const r = checkMemoryRateLimit("bound.k0", cfg);
		expect(r.remaining).toBe(4);
	});
});

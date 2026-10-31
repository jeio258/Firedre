import { describe, expect, it } from "vitest";
import { bumpContentVersion } from "../server/settings/service";

// 版本递增失败不得让已成功的主写返回失败（重试无幂等键会产生重复行）
describe("bumpContentVersion 容错", () => {
	it("版本递增失败时不抛出，主写成功语义不受影响", async () => {
		const env = {
			DB: {
				prepare: () => {
					throw new Error("simulated d1 failure");
				},
			},
		} as unknown as Parameters<typeof bumpContentVersion>[0];
		await expect(bumpContentVersion(env)).resolves.toBeUndefined();
	});

	it("版本递增成功时清空 isolate 版本缓存", async () => {
		const g = globalThis as unknown as { __FIREDRE_VER_CACHE__?: unknown };
		g.__FIREDRE_VER_CACHE__ = { value: "1", at: Date.now() };
		const env = {
			DB: {
				prepare: () => ({
					bind: () => ({
						run: async () => ({
							success: true,
							meta: { changes: 1, last_row_id: 0 },
						}),
					}),
				}),
			},
		} as unknown as Parameters<typeof bumpContentVersion>[0];
		await bumpContentVersion(env);
		expect(g.__FIREDRE_VER_CACHE__).toBeUndefined();
	});
});

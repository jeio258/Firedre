import { describe, it, expect } from "vitest";

describe("setting-utils importable", () => {
	it("exports expected functions in node env", async () => {
		const mod = await import("../src/utils/setting-utils");
		for (const fn of [
			"getStoredWavesEnabled",
			"setWavesEnabled",
			"getStoredGradientEnabled",
			"getStoredOverlayOpacity",
			"getStoredSakuraEnabled",
			"getStoredCardBorderEnabled",
			"getStoredBannerTitleEnabled",
		]) {
			expect(typeof (mod as Record<string, unknown>)[fn]).toBe("function");
		}
	});
});

import { describe, it, expect } from "vitest";
import { toClientSettings } from "../src/utils/client-settings";

function mergedFixture() {
	return {
		basic: { title: "Firedre", hue: 165, pageWidth: 100 },
		theme: { mode: "banner", dimOpacity: 0.2 },
		panel: { enable: true, wallpaperModeSwitchable: true },
		effects: { sakura: false, sakuraNum: 21 },
		mermaid: { enabled: true },
		gallery: {
			enabled: true,
			imgbedEnabled: true,
			imgbedEndpoint: "https://imge.example.com/api/manage/list",
			imgbedToken: "imgbed_secret_token",
		},
		ads: { enabled: false, adSenseId: "ca-pub-1", customCode: "<script>" },
		analytics: { umamiId: "abc" },
		comment: { type: "giscus", giscusRepoId: "R_kg" },
		music: { metingAuth: "auth-secret" },
		// middleware assignFlat 会把各组字段平铺到顶层
		title: "Firedre",
		hue: 165,
		pageWidth: 100,
		imgbedToken: "imgbed_secret_token",
		adSenseId: "ca-pub-1",
		metingAuth: "auth-secret",
	};
}

describe("toClientSettings", () => {
	it("仅下发客户端所需的五组配置", () => {
		const result = toClientSettings(mergedFixture());

		expect(Object.keys(result).sort()).toEqual(
			[
				"basic",
				"effects",
				"mermaid",
				"panel",
				"theme",
				"hue",
				"pageWidth",
				"title",
			].sort(),
		);
	});

	it("不下发含凭据的后台配置组", () => {
		const result = toClientSettings(mergedFixture());

		expect(result.gallery).toBeUndefined();
		expect(result.ads).toBeUndefined();
		expect(result.analytics).toBeUndefined();
		expect(result.comment).toBeUndefined();
		expect(result.music).toBeUndefined();
	});

	it("移除顶层平铺的敏感键", () => {
		const result = toClientSettings(mergedFixture());

		expect(result.imgbedToken).toBeUndefined();
		expect(result.adSenseId).toBeUndefined();
		expect(result.metingAuth).toBeUndefined();
		expect(JSON.stringify(result)).not.toContain("imgbed_secret_token");
	});

	it("保留白名单组与平铺键的取值", () => {
		const result = toClientSettings(mergedFixture());

		expect((result.basic as Record<string, unknown>).title).toBe("Firedre");
		expect((result.theme as Record<string, unknown>).mode).toBe("banner");
		expect((result.panel as Record<string, unknown>).enable).toBe(true);
		expect((result.effects as Record<string, unknown>).sakura).toBe(false);
		expect((result.mermaid as Record<string, unknown>).enabled).toBe(true);
		expect(result.hue).toBe(165);
		expect(result.pageWidth).toBe(100);
	});

	it("白名单组内出现敏感键名时兜底置空", () => {
		const merged = mergedFixture();
		(merged.basic as Record<string, unknown>).authToken = "leak";
		(merged.theme as Record<string, unknown>).apiKey = "leak";

		const result = toClientSettings(merged);

		expect((result.basic as Record<string, unknown>).authToken).toBe("");
		expect((result.theme as Record<string, unknown>).apiKey).toBe("");
		expect(JSON.stringify(result)).not.toContain("leak");
	});
});

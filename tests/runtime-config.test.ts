import { describe, it, expect } from "vitest";
import {
	getWallpaperConfig,
	getSiteConfig,
	getSidebarConfig,
	getSponsorConfig,
	getDynamicConfig,
	getPanelConfig,
} from "../src/config/runtime";

describe("runtime.getWallpaperConfig", () => {
	it("后台设置 theme.bannerUrl 时，src.desktop 替换为后台值（替换语义）", () => {
		const config = getWallpaperConfig({
			settings: {
				theme: { mode: "banner", bannerUrl: "https://t.alcy.cc/ycy" },
			},
		});
		const src = config.src as { desktop?: string[]; mobile?: string[] };
		expect(src.desktop).toEqual(["https://t.alcy.cc/ycy"]);
	});

	it("后台未设置 bannerUrl 时，保留静态默认桌面壁纸", () => {
		const config = getWallpaperConfig({ settings: {} });
		const src = config.src as { desktop?: string[]; mobile?: string[] };
		expect(src.desktop?.length ?? 0).toBeGreaterThan(0);
	});

	it("后台设置 mobileImages 时替换 mobile", () => {
		const config = getWallpaperConfig({
			settings: { theme: { mobileImages: "/img/m.jpg" } },
		});
		const src = config.src as { mobile?: string[] };
		expect(src.mobile).toEqual(["/img/m.jpg"]);
	});

	it("空 bannerUrl 回退静态默认", () => {
		const config = getWallpaperConfig({ settings: { theme: { bannerUrl: "" } } });
		const src = config.src as { desktop?: string[] };
		expect(src.desktop?.length ?? 0).toBeGreaterThan(0);
	});
});

describe("runtime.getSiteConfig", () => {
	it("后台 basic 组 title/subtitle 覆盖静态默认", () => {
		const config = getSiteConfig({
			settings: { basic: { title: "我的博客", subtitle: "副标题" } },
		});
		expect(config.title).toBe("我的博客");
		expect(config.subtitle).toBe("副标题");
	});

	it("无后台设置时使用静态默认", () => {
		const config = getSiteConfig({ settings: {} });
		expect(typeof config.title).toBe("string");
		expect(config.title.length).toBeGreaterThan(0);
	});

	it("conflictedKey title 从平铺层读不到时，仍从 basic 组读取", () => {
		const config = getSiteConfig({ settings: { basic: { title: "嵌套标题" } } });
		expect(config.title).toBe("嵌套标题");
	});
});

describe("runtime.getSidebarConfig", () => {
	it("读取后台 sidebar 组 show 开关", () => {
		const config = getSidebarConfig({
			settings: { sidebar: { showProfile: false, showTags: false } },
		});
		expect(config.showProfile).toBe(false);
		expect(config.showTags).toBe(false);
	});

	it("未设置时 show 开关默认 true", () => {
		const config = getSidebarConfig({ settings: {} });
		expect(config.showProfile).toBe(true);
		expect(config.showTags).toBe(true);
	});
});

describe("runtime.getSponsorConfig", () => {
	it("读取后台 sponsor 组开关", () => {
		const config = getSponsorConfig({
			settings: { sponsor: { showButtonInPost: false, showSponsorsList: false } },
		});
		expect(config.showButtonInPost).toBe(false);
		expect(config.showSponsorsList).toBe(false);
	});
});

describe("runtime.getDynamicConfig", () => {
	it("读取后台 dynamic 组 apiUrl/profileUrl", () => {
		const config = getDynamicConfig({
			settings: { dynamic: { apiUrl: "/api/feed.json", profileUrl: "/me" } },
		});
		expect(config.apiUrl).toBe("/api/feed.json");
		expect(config.profileUrl).toBe("/me");
	});
});

describe("runtime.getPanelConfig", () => {
	it("读取后台 panel 组开关，未设置时用 displaySettingsConfig 默认", () => {
		const config = getPanelConfig({
			settings: { panel: { wallpaperModeSwitchable: true } },
		});
		expect(config.wallpaperModeSwitchable).toBe(true);
		expect(typeof config.enable).toBe("boolean");
	});
});

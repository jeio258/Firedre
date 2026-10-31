import { getWallpaperConfig } from "@shared/config/runtime";
import { describe, expect, it } from "vitest";
import { backgroundWallpaper } from "@/config";
import { getBannerVisibilityState } from "@/utils/banner-visibility-utils";
import { getBackgroundImages } from "@/utils/layout-utils";

// 回归护栏：banner 图数必须跟随「运行时图源」，不得再用静态默认。
// 静态默认桌面/移动各 6 张 → 旧实现 hasMultipleImages 恒为 true。

const ctx = { isHomePage: true, isPostPage: false };

const stateOf = (theme: Record<string, unknown>) =>
	getBannerVisibilityState(ctx, { theme: { mode: "banner", ...theme } });

describe("R3 getBackgroundImages 运行时图源", () => {
	it("静态默认自身是多图（Bug 前提成立）", () => {
		expect(getBackgroundImages().isMultiple).toBe(true);
	});

	it("缺省参数回退静态默认（与显式传 backgroundWallpaper.src 等价）", () => {
		expect(getBackgroundImages()).toEqual(
			getBackgroundImages(backgroundWallpaper.src),
		);
	});

	it("显式传入单图对象 → isMultiple=false", () => {
		expect(
			getBackgroundImages({ desktop: ["/a.jpg"], mobile: ["/m.jpg"] })
				.isMultiple,
		).toBe(false);
	});
});

describe("R3 getBannerVisibilityState.hasMultipleImages 跟随运行时源", () => {
	it("正向：后台设为单张（桌面+移动各一）→ false", () => {
		expect(
			stateOf({ bannerUrl: "/a.jpg", mobileImages: "/m.jpg" })
				.hasMultipleImages,
		).toBe(false);
	});

	it("灵敏度：旧静态实现会判 true，本实现为 false（回归护栏）", () => {
		const runtime = stateOf({
			bannerUrl: "/a.jpg",
			mobileImages: "/m.jpg",
		}).hasMultipleImages;
		const legacyStatic = getBackgroundImages().isMultiple;
		expect(legacyStatic).toBe(true); // 旧实现结果
		expect(runtime).toBe(false); // 修复后结果，必须与旧实现相异
		expect(runtime).not.toBe(legacyStatic);
	});

	it("正向：后台设为多张（逗号分隔）→ true", () => {
		expect(
			stateOf({ bannerUrl: "/a.jpg,/b.jpg", mobileImages: "/m.jpg" })
				.hasMultipleImages,
		).toBe(true);
	});

	it("hasMultipleImages 恒等于「运行时图源」推导值", () => {
		const settings = {
			theme: {
				mode: "banner",
				bannerUrl: "/x.jpg,/y.jpg",
				mobileImages: "/z.jpg",
			},
		};
		const images = getBackgroundImages(getWallpaperConfig({ settings }).src);
		expect(getBannerVisibilityState(ctx, settings).hasMultipleImages).toBe(
			images.desktop.length > 1 || images.mobile.length > 1,
		);
	});
});

// theme 域 getter（B4 自 runtime.ts 机械拆分，逻辑零改动）
import type { BackgroundWallpaperConfig } from "@/types/backgroundWallpaper";
import type { SakuraConfig } from "@/types/config";
import type { DisplaySettingsConfig } from "@/types/displaySettingsConfig";
import { bool, groupOf, num, settingsOf, str } from "./helpers";

export function getWallpaperConfig(locals: unknown) {
	const s = settingsOf(locals);
	const t = groupOf(s, "theme");
	const wb = (t.wallpaperBase ?? {}) as BackgroundWallpaperConfig;
	// 外链壁纸走同源代理：服务端定型随机图（跟 302）并边缘缓存，
	// preload 与渲染同 URL 单次下载，避免随机 API 慢回源拖垮首屏
	const proxiedWallpaper = (u: string, w: number) =>
		/^https:\/\//.test(u)
			? `/api/cover-proxy/?u=${encodeURIComponent(u)}&w=${w}&f=webp`
			: u;
	return {
		...wb,
		mode: str(t.mode, wb.mode ?? "banner") as BackgroundWallpaperConfig["mode"],
		playerEnable: bool(t.playerEnable, wb.playerEnable ?? true),
		src: {
			...(typeof wb.src === "object" && !Array.isArray(wb.src) ? wb.src : {}),
			...(typeof t.bannerUrl === "string" && t.bannerUrl
				? {
						desktop: t.bannerUrl
							.split(",")
							.map((x: string) => proxiedWallpaper(x.trim(), 1920))
							.filter(Boolean),
					}
				: {}),
			...(typeof t.mobileImages === "string" && t.mobileImages
				? {
						mobile: t.mobileImages
							.split(",")
							.map((x: string) => proxiedWallpaper(x.trim(), 828))
							.filter(Boolean),
					}
				: {}),
			...(typeof t.playerUrl === "string" && t.playerUrl
				? {
						playerUrl: t.playerUrl
							.split(",")
							.map((x: string) => x.trim())
							.filter(Boolean),
					}
				: {}),
		},
		common: {
			...(wb.common ?? {}),
			dimOpacity: num(t.dimOpacity, wb.common?.dimOpacity ?? 0),
			playerMode: str(t.playerMode, wb.common?.playerMode ?? "order"),
			homeText: {
				...(wb.common?.homeText ?? {}),
				enable: bool(t.homeTextEnable, wb.common?.homeText?.enable ?? true),
				title: str(t.homeTitle, wb.common?.homeText?.title ?? ""),
				titleSize: str(
					t.homeTitleSize,
					wb.common?.homeText?.titleSize ?? "4.5rem",
				),
				subtitle: (() => {
					if (Array.isArray(t.homeSubtitles)) {
						return t.homeSubtitles.map(String);
					}
					if (typeof t.homeSubtitles === "string") {
						try {
							const parsed = JSON.parse(t.homeSubtitles);
							if (Array.isArray(parsed)) {
								return parsed.map(String);
							}
						} catch {}
					}
					return (
						Array.isArray(wb.common?.homeText?.subtitle)
							? wb.common.homeText.subtitle
							: []
					).map(String);
				})(),
				subtitleSize: str(
					t.homeSubtitleSize,
					wb.common?.homeText?.subtitleSize ?? "1.5rem",
				),
				typewriter: {
					...(wb.common?.homeText?.typewriter ?? {}),
					enable: bool(
						t.typewriter,
						wb.common?.homeText?.typewriter?.enable ?? true,
					),
					speed: num(
						t.typewriterSpeed,
						wb.common?.homeText?.typewriter?.speed ?? 100,
					),
					deleteSpeed: num(
						t.typewriterDeleteSpeed,
						wb.common?.homeText?.typewriter?.deleteSpeed ?? 50,
					),
					pauseTime: num(
						t.typewriterPauseTime,
						wb.common?.homeText?.typewriter?.pauseTime ?? 2000,
					),
				},
			},
			carousel: {
				...(wb.common?.carousel ?? {}),
				enable: bool(t.carousel, wb.common?.carousel?.enable ?? false),
				interval: num(
					t.carouselInterval,
					wb.common?.carousel?.interval ?? 5000,
				),
				transitionEffect: str(
					t.carouselTransition,
					wb.common?.carousel?.transitionEffect ?? "zoom",
				),
			},
		},
		overlay: {
			...(wb.overlay ?? {}),
			opacity: num(t.overlayOpacity, wb.overlay?.opacity ?? 0.8),
			blur: num(t.overlayBlur, wb.overlay?.blur ?? 0),
			cardOpacity: num(t.overlayCardOpacity, wb.overlay?.cardOpacity ?? 0.6),
		},
		banner: {
			...(wb.banner ?? {}),
			navbar: {
				...(wb.banner?.navbar ?? {}),
				transparentMode:
					str(
						(
							t.banner as
								| { navbar?: { transparentMode?: unknown; blur?: unknown } }
								| undefined
						)?.navbar?.transparentMode,
						(
							(wb.banner as unknown as Record<string, unknown>)?.navbar as
								| Record<string, unknown>
								| undefined
						)?.transparentMode as string,
					) ?? "semi",
				blur:
					num(
						(
							t.banner as
								| { navbar?: { transparentMode?: unknown; blur?: unknown } }
								| undefined
						)?.navbar?.blur,
						(
							(wb.banner as unknown as Record<string, unknown>)?.navbar as
								| Record<string, unknown>
								| undefined
						)?.blur as number,
					) ?? 20,
			},
		},
		fullscreen: {
			...(wb.fullscreen ?? {}),
			navbar: {
				...(wb.fullscreen?.navbar ?? {}),
				dynamicTransparent:
					bool(
						(
							t.fullscreen as
								| { navbar?: { dynamicTransparent?: unknown } }
								| undefined
						)?.navbar?.dynamicTransparent,
						(
							(wb.fullscreen as unknown as Record<string, unknown>)?.navbar as
								| Record<string, unknown>
								| undefined
						)?.dynamicTransparent as boolean,
					) ?? true,
			},
		},
	};
}

export function getPanelConfig(locals: unknown): DisplaySettingsConfig {
	const s = settingsOf(locals);
	const pn = groupOf(s, "panel");
	return {
		overlaySwitchable: bool(pn.overlaySwitchable, false),
		enable: bool(pn.enable, false),
		themeColorSwitchable: bool(pn.themeColorSwitchable, false),
		layoutSwitchable: bool(pn.layoutSwitchable, false),
		cardBorderSwitchable: bool(pn.cardBorderSwitchable, false),
		cardFollowThemeSwitchable: bool(pn.cardFollowThemeSwitchable, false),
		wallpaperModeSwitchable: bool(pn.wallpaperModeSwitchable, false),
		wavesSwitchable: bool(pn.wavesSwitchable, false),
		gradientSwitchable: bool(pn.gradientSwitchable, false),
		bannerTitleSwitchable: bool(pn.bannerTitleSwitchable, false),
		bannerCarouselSwitchable: bool(pn.bannerCarouselSwitchable, false),
		sakuraSwitchable: bool(pn.sakuraSwitchable, false),
		overlayOpacitySwitchable: bool(pn.overlayOpacitySwitchable, false),
		overlayBlurSwitchable: bool(pn.overlayBlurSwitchable, false),
		overlayCardOpacitySwitchable: bool(pn.overlayCardOpacitySwitchable, false),
	};
}

export function getEffectsConfig(locals: unknown): SakuraConfig {
	const s = settingsOf(locals);
	const e = groupOf(s, "effects");
	return {
		enable: bool(e.sakura, false),
		sakuraNum: num(e.sakuraNum, 21),
		limitTimes: num(e.limitTimes, -1),
		size: { min: 0.5, max: 1.1 },
		opacity: { min: 0.3, max: 0.9 },
		speed: {
			horizontal: { min: -1.7, max: -1.2 },
			vertical: { min: 1.5, max: 2.2 },
			rotation: 0.03,
			fadeSpeed: 0.03,
		},
		zIndex: 100,
		waves: bool(e.waves, true),
		gradient: bool(e.gradient, true),
		bannerCarousel: bool(e.bannerCarousel, false),
	};
}

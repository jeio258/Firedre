import { backgroundWallpaper, displaySettingsConfig } from "@/config";
import { getImageQuality } from "@/utils/image-utils";
import { getBackgroundImages } from "@/utils/layout-utils";

export interface BannerPostMeta {
	title: string;
	description?: string;
	published: Date;
	updated?: Date;
	words?: number;
	minutes?: number;
}

export interface BannerVisibilityContext {
	isHomePage: boolean;
	isPostPage: boolean;
	title?: string;
	bannerPostMeta?: BannerPostMeta;
}

export interface BannerVisibilityState {
	isBannerMode: boolean;
	isFullscreenMode: boolean;
	isOverlayMode: boolean;
	isWallpaperSwitchable: boolean;
	isBackgroundEnabled: boolean;
	hasWallpaper: boolean;
	wavesEnabledOnDesktop: boolean | undefined;
	wavesEnabledOnMobile: boolean | undefined;
	shouldRenderWaves: boolean;
	gradientEnabledOnDesktop: boolean;
	gradientEnabledOnMobile: boolean;
	shouldRenderGradient: boolean;
	gradientHeight: string;
	homeTextEnable: boolean;
	showHomeText: boolean;
	homeTextLinksEnable: boolean;
	initialRandomSubtitle: string | undefined;
	showBannerPostMeta: boolean;
	bannerPostInfoMode: "description" | "meta";
	bannerDescriptionWidth: string | undefined;
	showBannerDim: boolean;
	dimOpacity: number;
	showBannerPageTitle: boolean;
	bannerCarouselEnabledDefault: boolean;
	bannerCarouselSwitchable: boolean;
	bannerCarouselInterval: number;
	bannerCarouselEffect: string;
	hasMultipleImages: boolean;
	configQuality: number;
	mobileQuality: number;
}

function getRandomSubtitle(): string | undefined {
	const subtitle = backgroundWallpaper.common?.homeText?.subtitle;
	if (Array.isArray(subtitle)) {
		const randomIndex = Math.floor(Math.random() * subtitle.length);
		return subtitle[randomIndex];
	}
	return subtitle;
}

export function getBannerDescriptionWidth(
	description?: string,
): string | undefined {
	if (!description) return undefined;

	const textUnits = Array.from(description).reduce((total, character) => {
		if (/\s/u.test(character)) return total + 0.35;
		const codePoint = character.codePointAt(0) ?? 0;
		return total + (codePoint <= 0xff ? 0.55 : 1);
	}, 0);
	const maxLineUnits = 52;
	const lineCount = Math.max(1, Math.ceil(textUnits / maxLineUnits));

	if (lineCount === 1) return undefined;

	const targetLineUnits = Math.min(maxLineUnits, textUnits / (lineCount - 0.5));
	return `${Math.max(28, targetLineUnits).toFixed(1)}em`;
}

export function getBannerVisibilityState(
	ctx: BannerVisibilityContext,
	settings?: Record<string, unknown> | undefined,
): BannerVisibilityState {
	const {
		isHomePage: isHomePageCheck,
		isPostPage,
		title,
		bannerPostMeta,
	} = ctx;

	const themeS = (settings?.["theme"] ?? {}) as Record<string, unknown>;
	const effectsS = (settings?.["effects"] ?? {}) as Record<string, unknown>;
	const panelS = (settings?.["panel"] ?? {}) as Record<string, unknown>;

	const boolOr = (v: unknown, fallback: boolean): boolean =>
		typeof v === "boolean" ? v : fallback;

	const wallpaperMode =
		(typeof themeS["mode"] === "string" && (themeS["mode"] as string)) ||
		backgroundWallpaper.mode;
	const isBannerMode = wallpaperMode === "banner";
	const isFullscreenMode = wallpaperMode === "fullscreen";
	const isOverlayMode = wallpaperMode === "overlay";
	const isWallpaperSwitchable = boolOr(panelS["wallpaperModeSwitchable"], displaySettingsConfig.wallpaperModeSwitchable);
	const isBackgroundEnabled =
		wallpaperMode !== "none" || isWallpaperSwitchable;

	const effectsWaves = effectsS["waves"];
	const wavesConfig =
		typeof effectsWaves === "boolean"
			? effectsWaves
			: backgroundWallpaper.banner?.waves?.enable;
	const wavesSwitchable = boolOr(panelS["wavesSwitchable"], displaySettingsConfig.wavesSwitchable);
	const wavesEnabledOnDesktop =
		typeof wavesConfig === "object" ? wavesConfig.desktop : wavesConfig;
	const wavesEnabledOnMobile =
		typeof wavesConfig === "object" ? wavesConfig.mobile : wavesConfig;
	const shouldRenderWaves =
		wavesEnabledOnDesktop || wavesEnabledOnMobile || wavesSwitchable;

	const effectsGradient = effectsS["gradient"];
	const gradientConfig =
		typeof effectsGradient === "boolean"
			? effectsGradient
			: backgroundWallpaper.banner?.gradient?.enable;
	const gradientSwitchable = boolOr(panelS["gradientSwitchable"], displaySettingsConfig.gradientSwitchable);
	const gradientEnabledOnDesktop =
		typeof gradientConfig === "object"
			? gradientConfig.desktop
			: (gradientConfig ?? true);
	const gradientEnabledOnMobile =
		typeof gradientConfig === "object"
			? gradientConfig.mobile
			: (gradientConfig ?? true);
	const gradientHeight = backgroundWallpaper.banner?.gradient?.height ?? "10%";
	const shouldRenderGradient =
		gradientEnabledOnDesktop || gradientEnabledOnMobile || gradientSwitchable;

	const homeTextEnable =
		(typeof themeS["homeTextEnable"] === "boolean"
			? themeS["homeTextEnable"]
			: backgroundWallpaper.common?.homeText?.enable) ?? false;
	const showHomeText =
		(isBannerMode || isFullscreenMode) && !!homeTextEnable && isHomePageCheck;
	const homeTextLinksEnable =
		backgroundWallpaper.common?.homeText?.linksEnable !== false;

	const showBannerPostMeta =
		(isBannerMode || isWallpaperSwitchable) &&
		isBackgroundEnabled &&
		!isHomePageCheck &&
		isPostPage &&
		!!bannerPostMeta;

	const bannerPostInfoMode =
		backgroundWallpaper.banner?.postInfo?.mode ?? "description";

	const bannerDescriptionWidth = getBannerDescriptionWidth(
		bannerPostMeta?.description,
	);

	const showBannerDim =
		(isBannerMode || isFullscreenMode || isWallpaperSwitchable) &&
		isBackgroundEnabled;
	const dimOpacity =
		(typeof themeS["dimOpacity"] === "number"
			? themeS["dimOpacity"]
			: backgroundWallpaper.common?.dimOpacity) ?? 0.15;

	const showBannerPageTitle =
		(isBannerMode || isWallpaperSwitchable) &&
		isBackgroundEnabled &&
		!isHomePageCheck &&
		!isPostPage &&
		!!title;

	const backgroundImages = getBackgroundImages();
	const configQuality = getImageQuality();
	const mobileQuality = Math.round(configQuality * 0.9);

	const bannerCarouselEnabledDefault =
		(typeof themeS["carousel"] === "boolean"
			? themeS["carousel"]
			: backgroundWallpaper.common?.carousel?.enable) ?? false;
	const bannerCarouselSwitchable =
		boolOr(panelS["bannerCarouselSwitchable"], displaySettingsConfig.bannerCarouselSwitchable);
	const bannerCarouselInterval = Math.max(
		(typeof themeS["carouselInterval"] === "number"
			? themeS["carouselInterval"]
			: backgroundWallpaper.common?.carousel?.interval) ?? 5000,
		3000,
	);
	const bannerCarouselEffect =
		(typeof themeS["carouselTransition"] === "string" &&
			(themeS["carouselTransition"] as string)) ||
		(backgroundWallpaper.common?.carousel?.transitionEffect ?? "fade");
	const hasMultipleImages =
		backgroundImages.desktop.length > 1 || backgroundImages.mobile.length > 1;

	return {
		isBannerMode,
		isFullscreenMode,
		isOverlayMode,
		isWallpaperSwitchable,
		isBackgroundEnabled,
		hasWallpaper:
			isWallpaperSwitchable ||
			isBannerMode ||
			isFullscreenMode ||
			isOverlayMode,
		wavesEnabledOnDesktop,
		wavesEnabledOnMobile,
		shouldRenderWaves,
		gradientEnabledOnDesktop,
		gradientEnabledOnMobile,
		shouldRenderGradient,
		gradientHeight,
		homeTextEnable,
		showHomeText,
		homeTextLinksEnable,
		initialRandomSubtitle: getRandomSubtitle(),
		showBannerPostMeta,
		bannerPostInfoMode,
		bannerDescriptionWidth,
		showBannerDim,
		dimOpacity,
		showBannerPageTitle,
		bannerCarouselEnabledDefault,
		bannerCarouselSwitchable,
		bannerCarouselInterval,
		bannerCarouselEffect,
		hasMultipleImages,
		configQuality,
		mobileQuality,
	};
}

import {
	getEffectsConfigFromWindow,
	getPanelConfigFromWindow,
	getSiteConfigFromWindow,
	getWallpaperConfigFromWindow,
} from "@shared/config/runtime";
import { backgroundWallpaper, sakuraConfig, siteConfig } from "../../config";
import {
	createDeviceBooleanDefault,
	createElementToggle,
	createStoredBoolean,
} from "./shared";

declare global {
	interface Window {
		initSemifullScrollDetection?: () => void;
		semifullScrollHandler?: () => void;
	}
}

export const getDefaultWavesEnabled = createDeviceBooleanDefault(
	() => getEffectsConfigFromWindow().waves,
	backgroundWallpaper.banner?.waves?.enable,
	false,
);

const applyWavesEnabledToDocument = createElementToggle(
	"data-waves-enabled",
	"header-waves",
	"waves-disabled",
);
const applyGradientEnabledToDocument = createElementToggle(
	"data-gradient-enabled",
	"wallpaper-gradient",
	"gradient-disabled",
);

const wavesSetting = createStoredBoolean({
	key: "wavesEnabled",
	getDefault: getDefaultWavesEnabled,
	afterStore: applyWavesEnabledToDocument,
});

export function getStoredWavesEnabled(): boolean {
	return wavesSetting.getStored();
}
export function setWavesEnabled(enabled: boolean): void {
	wavesSetting.set(enabled);
}

export const getDefaultGradientEnabled = createDeviceBooleanDefault(
	() => getEffectsConfigFromWindow().gradient,
	backgroundWallpaper.banner?.gradient?.enable,
	true,
);

const gradientSetting = createStoredBoolean({
	key: "gradientEnabled",
	getDefault: getDefaultGradientEnabled,
	afterStore: applyGradientEnabledToDocument,
});
export function getStoredGradientEnabled(): boolean {
	return gradientSetting.getStored();
}
export function setGradientEnabled(enabled: boolean): void {
	gradientSetting.set(enabled);
}

export function getDefaultSakuraEnabled(): boolean {
	return getEffectsConfigFromWindow().enable ?? sakuraConfig?.enable ?? false;
}

const sakuraSetting = createStoredBoolean({
	key: "sakuraEnabled",
	getDefault: getDefaultSakuraEnabled,
	afterStore(enabled: boolean): void {
		if (typeof document === "undefined") return;
		document.documentElement.setAttribute(
			"data-sakura-enabled",
			String(enabled),
		);
		if (typeof window !== "undefined") {
			window.dispatchEvent(
				new CustomEvent("sakuraToggle", { detail: { enabled } }),
			);
		}
	},
});
export function getStoredSakuraEnabled(): boolean {
	return sakuraSetting.getStored();
}
export function setSakuraEnabled(enabled: boolean): void {
	sakuraSetting.set(enabled);
}

export function getDefaultBannerTitleEnabled(): boolean {
	return (
		getWallpaperConfigFromWindow().common?.homeText?.enable ??
		backgroundWallpaper.common?.homeText?.enable ??
		true
	);
}

export function getDefaultBannerCarouselEnabled(): boolean {
	return (
		getEffectsConfigFromWindow().bannerCarousel ??
		backgroundWallpaper.common?.carousel?.enable ??
		false
	);
}

const bannerTitleSetting = createStoredBoolean({
	key: "bannerTitleEnabled",
	getDefault: getDefaultBannerTitleEnabled,
	afterStore: applyBannerTitleEnabledToDocument,
});

export function getStoredBannerTitleEnabled(): boolean {
	return bannerTitleSetting.getStored();
}

const bannerCarouselSetting = createStoredBoolean({
	key: "bannerCarouselEnabled",
	getDefault: getDefaultBannerCarouselEnabled,
	shouldGet: () => getPanelConfigFromWindow().bannerCarouselSwitchable,
	shouldStore: () => getPanelConfigFromWindow().bannerCarouselSwitchable,
	afterStore: (value) => {
		applyBannerCarouselEnabledToDocument(value);
		if (typeof window !== "undefined") {
			window.dispatchEvent(
				new CustomEvent("bannerCarouselChange", {
					detail: { enabled: value },
				}),
			);
		}
	},
});

export function getStoredBannerCarouselEnabled(): boolean {
	return bannerCarouselSetting.getStored();
}

export function setBannerTitleEnabled(enabled: boolean): void {
	bannerTitleSetting.set(enabled);
}
export function setBannerCarouselEnabled(enabled: boolean): void {
	bannerCarouselSetting.set(Boolean(enabled));
}

function applyBannerTitleEnabledToDocument(enabled: boolean): void {
	if (typeof document === "undefined") {
		return;
	}
	// 更新 html 属性，CSS 会立即生效
	document.documentElement.setAttribute(
		"data-banner-title-enabled",
		String(enabled),
	);

	const bannerTextOverlay = document.querySelector(
		".banner-home-text-overlay",
	) as HTMLElement;
	if (bannerTextOverlay) {
		if (enabled) {
			bannerTextOverlay.classList.remove("user-hidden");
		} else {
			bannerTextOverlay.classList.add("user-hidden");
		}
	}
}

function applyBannerCarouselEnabledToDocument(enabled: boolean): void {
	if (typeof document === "undefined") {
		return;
	}
	document.documentElement.setAttribute(
		"data-banner-carousel-enabled",
		String(enabled),
	);
}

export function getDefaultCardBorderEnabled(): boolean {
	return (
		getSiteConfigFromWindow().card?.border ?? siteConfig.card?.border ?? false
	);
}

const cardBorderSetting = createStoredBoolean({
	key: "cardBorderEnabled",
	getDefault: getDefaultCardBorderEnabled,
	afterStore(enabled: boolean): void {
		if (typeof document === "undefined") return;
		if (enabled) document.documentElement.classList.add("enable-card-border");
		else document.documentElement.classList.remove("enable-card-border");
	},
});
export function getStoredCardBorderEnabled(): boolean {
	return cardBorderSetting.getStored();
}
export function setCardBorderEnabled(enabled: boolean): void {
	cardBorderSetting.set(enabled);
}

// 客户端 window 设置视图（B4 自 runtime.ts 机械拆分）

import { getExpressiveCodeConfig } from "./content";
import type { SettingsLike } from "./helpers";
import { getNavbarConfig } from "./layout";
import { getSiteConfig } from "./site";
import { getEffectsConfig, getPanelConfig, getWallpaperConfig } from "./theme";

function windowSettings(): SettingsLike {
	if (typeof window === "undefined") return {};
	return ((window as unknown as { __FIREFLY_SETTINGS__?: SettingsLike })
		.__FIREFLY_SETTINGS__ ?? {}) as SettingsLike;
}

export function getSiteConfigFromWindow() {
	return getSiteConfig({ settings: windowSettings() });
}
export function getEffectsConfigFromWindow() {
	return getEffectsConfig({ settings: windowSettings() });
}
export function getWallpaperConfigFromWindow() {
	return getWallpaperConfig({ settings: windowSettings() });
}
export function getPanelConfigFromWindow() {
	return getPanelConfig({ settings: windowSettings() });
}
export function getNavbarConfigFromWindow() {
	return getNavbarConfig({ settings: windowSettings() });
}
export function getExpressiveCodeConfigFromWindow() {
	return getExpressiveCodeConfig({ settings: windowSettings() });
}

import type { DisplaySettingsConfig } from "@/types/displaySettingsConfig";
import { parseBooleanEnv } from "./boolean-env";

const DISABLED_SETTINGS: DisplaySettingsConfig = {
	enable: false,
	themeColorSwitchable: false,
	layoutSwitchable: false,
	cardBorderSwitchable: false,
	cardFollowThemeSwitchable: false,
	wallpaperModeSwitchable: false,
	wavesSwitchable: false,
	gradientSwitchable: false,
	bannerTitleSwitchable: false,
	bannerCarouselSwitchable: false,
	overlaySwitchable: false,
	sakuraSwitchable: false,
};

function readEnableEnv(): unknown {
	try {
		return import.meta.env.PUBLIC_DISPLAY_SETTINGS;
	} catch {
		return typeof process === "undefined"
			? undefined
			: process.env.PUBLIC_DISPLAY_SETTINGS;
	}
}

export function resolveDisplaySettingsConfig(
	config: DisplaySettingsConfig,
): DisplaySettingsConfig {
	const enable = parseBooleanEnv(readEnableEnv()) ?? config.enable;
	return enable ? { ...config, enable: true } : DISABLED_SETTINGS;
}

import type { DisplaySettingsConfig } from "../types/displaySettingsConfig";
import { resolveDisplaySettingsConfig } from "../utils/display-settings-utils";

export const displaySettingsConfig: DisplaySettingsConfig =
	resolveDisplaySettingsConfig({

		enable: false,

		themeColorSwitchable: true,

		layoutSwitchable: true,

		cardBorderSwitchable: true,

		cardFollowThemeSwitchable: true,

		wallpaperModeSwitchable: true,

		wavesSwitchable: true,

		gradientSwitchable: true,

		// 横幅标题显示开关（需同时启用 homeText.enable）
		bannerTitleSwitchable: true,

		bannerCarouselSwitchable: true,

		overlaySwitchable: {
			opacity: true,
			blur: true,
			cardOpacity: true,
		},

		sakuraSwitchable: true,
	});

import type { DisplaySettingsConfig } from "../types/displaySettingsConfig";
import { resolveDisplaySettingsConfig } from "../utils/display-settings-utils";

export const displaySettingsConfig: DisplaySettingsConfig =
	resolveDisplaySettingsConfig({

		enable: false,

		// 主题色选择器开关
		themeColorSwitchable: true,

		// 文章列表布局切换开关
		layoutSwitchable: true,

		// 卡片边框和阴影开关
		cardBorderSwitchable: true,

		// 卡片风格跟随主题色开关
		cardFollowThemeSwitchable: true,

		wallpaperModeSwitchable: true,

		// 水波纹动画开关
		wavesSwitchable: true,

		// 渐变过渡效果开关
		gradientSwitchable: true,

		// 横幅标题显示开关（需同时启用 homeText.enable）
		bannerTitleSwitchable: true,

		// 壁纸轮播开关
		bannerCarouselSwitchable: true,

		overlaySwitchable: {
			opacity: true,
			blur: true,
			cardOpacity: true,
		},

		// 樱花特效开关
		sakuraSwitchable: true,
	});

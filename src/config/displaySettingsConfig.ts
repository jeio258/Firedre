import type { DisplaySettingsConfig } from "../types/displaySettingsConfig";
import { resolveDisplaySettingsConfig } from "../utils/display-settings-utils";

// 显示设置面板开关配置：集中控制哪些设置项对用户可见，也便于调试预览。

export const displaySettingsConfig: DisplaySettingsConfig =
	resolveDisplaySettingsConfig({
		// ── 总开关 (Master switch) ──

		// 关闭时导航栏入口、设置面板以及下方所有设置项均不生效。
		// 开启会把面板组件及其依赖打进客户端产物，首屏多一份 JS。
		// 也可不改本文件，改用部署平台环境变量 PUBLIC_DISPLAY_SETTINGS=true
		// （环境变量优先级更高）。生产环境建议关闭，仅开发调试时开启预览。
		enable: false,

		// ── 外观 (Appearance) ──

		// 主题色选择器开关
		themeColorSwitchable: true,

		// 文章列表布局切换开关
		layoutSwitchable: true,

		// 卡片边框和阴影开关
		cardBorderSwitchable: true,

		// 卡片风格跟随主题色开关
		cardFollowThemeSwitchable: true,

		// ── 壁纸 (Wallpaper) ──

		// 壁纸模式切换开关，构建体积的大头：
		// 为 true 时构建期必须打包各壁纸模式所需整套内容，约 +33 KB/页；
		// 为 false 则始终使用 backgroundWallpaper 配置的默认壁纸模式。
		wallpaperModeSwitchable: true,

		// 水波纹动画开关
		wavesSwitchable: true,

		// 渐变过渡效果开关
		gradientSwitchable: true,

		// 横幅标题显示开关（需同时启用 homeText.enable）
		bannerTitleSwitchable: true,

		// 壁纸轮播开关
		bannerCarouselSwitchable: true,

		// 全屏壁纸/透明覆盖模式参数调节开关
		// 设为 false 关闭所有滑块，或用对象形式单独控制每个滑块
		overlaySwitchable: {
			opacity: true,
			blur: true,
			cardOpacity: true,
		},

		// ── 特效 (Effects) ──

		// 樱花特效开关
		sakuraSwitchable: true,
	});

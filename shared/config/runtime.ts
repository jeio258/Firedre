/**
 * 运行时配置层桶文件（B4）：实现按域拆分于 ./runtime/*，此处仅转发，导出面与拆分前一致。
 * 取值优先级：D1 后台设置（动态主路径）→ settings-defaults（运行时默认）→ 无静态兜底。
 */

export {
	getAnalyticsConfig,
	getAnnouncementConfig,
	getBooknavConfig,
	getCommentConfig,
	getCoverConfig,
	getDynamicConfig,
	getExpressiveCodeConfig,
	getFontConfig,
	getHitokotoConfig,
	getLicenseConfig,
	getMermaidConfig,
	getMusicConfig,
	getPlantumlConfig,
	getProfileConfig,
	getSponsorConfig,
} from "./runtime/content";
export { defaultsLocals, type SettingsLike } from "./runtime/helpers";
export {
	getFooterConfig,
	getNavbarConfig,
	getSidebarConfig,
} from "./runtime/layout";
export { getSiteConfig } from "./runtime/site";
export {
	getEffectsConfig,
	getPanelConfig,
	getWallpaperConfig,
} from "./runtime/theme";
export {
	getEffectsConfigFromWindow,
	getExpressiveCodeConfigFromWindow,
	getNavbarConfigFromWindow,
	getPanelConfigFromWindow,
	getSiteConfigFromWindow,
	getWallpaperConfigFromWindow,
} from "./runtime/window";

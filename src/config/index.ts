// 配置桶（A5）：值导出全部由运行时 getter 以 defaults 单一源派生，消费方 import 路径不变
import {
	defaultsLocals,
	getAnalyticsConfig,
	getAnnouncementConfig,
	getBooknavConfig,
	getCommentConfig,
	getCoverConfig,
	getDynamicConfig,
	getEffectsConfig,
	getExpressiveCodeConfig,
	getFooterConfig,
	getLicenseConfig,
	getMermaidConfig,
	getMusicConfig,
	getNavbarConfig,
	getPanelConfig,
	getPlantumlConfig,
	getProfileConfig,
	getSidebarConfig,
	getSiteConfig,
	getSponsorConfig,
	getWallpaperConfig,
} from "@shared/config/runtime";

export const siteConfig = getSiteConfig(defaultsLocals);
export const navBarConfig = getNavbarConfig(defaultsLocals);
export const sidebarLayoutConfig = getSidebarConfig(defaultsLocals);
export const backgroundWallpaper = getWallpaperConfig(defaultsLocals);
export const displaySettingsConfig = getPanelConfig(defaultsLocals);
export const profileConfig = getProfileConfig(defaultsLocals);
export const commentConfig = getCommentConfig(defaultsLocals);
export const musicPlayerConfig = getMusicConfig(defaultsLocals);
export const footerConfig = getFooterConfig(defaultsLocals);
export const sakuraConfig = getEffectsConfig(defaultsLocals);
export const licenseConfig = getLicenseConfig(defaultsLocals);
export const sponsorConfig = getSponsorConfig(defaultsLocals);
export const dynamicConfig = getDynamicConfig(defaultsLocals);
export const announcementConfig = getAnnouncementConfig(defaultsLocals);
export const coverImageConfig = getCoverConfig(defaultsLocals);
export const mermaidConfig = getMermaidConfig(defaultsLocals);
export const plantumlConfig = getPlantumlConfig(defaultsLocals);
export const analyticsConfig = getAnalyticsConfig(defaultsLocals);
export const expressiveCodeConfig = getExpressiveCodeConfig(defaultsLocals);

const booknavDefaults = getBooknavConfig(defaultsLocals);
export const booknavConfig = booknavDefaults.groups;
export const booknavPageConfig = {
	title: booknavDefaults.title,
	description: booknavDefaults.description,
	favicon: booknavDefaults.favicon,
};

// 友链页结构常量（原 friendsConfig 原值；动态部分经 friends 组/D1 另行读取）
export const friendsPageConfig = {
	title: "",
	description: "",
	showCustomContent: true,
	showComment: true,
	randomizeSort: false,
};

export { fontConfig, fontsList } from "@shared/config/fontConfig";

import { getNavbarConfigFromWindow } from "@shared/config/runtime";
import type { NavbarMode } from "../types/navBarConfig";

/** 解析导航栏模式：navbarMode 优先，否则按旧 stickyNavbar 兼容映射（true→fixed，false→static） */
export function resolveNavbarMode(navbar: {
	navbarMode?: NavbarMode;
	stickyNavbar?: boolean;
}): NavbarMode {
	if (navbar.navbarMode) return navbar.navbarMode;
	return navbar.stickyNavbar === false ? "static" : "fixed";
}

/** 当前导航栏模式（已按 navbarMode / 旧 stickyNavbar 解析），供各消费方统一读取 */
export const navbarMode: NavbarMode = resolveNavbarMode(siteConfig.navbar);

let cachedSettingsSrc: unknown = null;
let clientNavbarMode: NavbarMode | null = null;

/** 客户端导航栏模式：后台运行时设置（window.__FIREFLY_SETTINGS__）优先，静态配置兜底。
 *  settings-live 更新注入对象后（对象身份变化）自动重解析，实现设置变更实时生效 */
export function resolveClientNavbarMode(): NavbarMode {
	const src = (window as { __FIREFLY_SETTINGS__?: unknown })
		.__FIREFLY_SETTINGS__;
	if (clientNavbarMode === null || src !== cachedSettingsSrc) {
		cachedSettingsSrc = src;
		clientNavbarMode = resolveNavbarMode(getNavbarConfigFromWindow());
	}
	return clientNavbarMode;
}

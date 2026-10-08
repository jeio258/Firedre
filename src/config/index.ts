// 配置桶（A5）：值导出全部由运行时 getter 以 defaults 单一源派生，消费方 import 路径不变
// B20（2026-10-08）：已裁剪零读取方导出——运行期消费统一走 getXxxConfig；
// 若某导出确需保留静态读取，请在 B21 护栏（scripts/config-static-guard.mjs）基线中说明。
import {
	defaultsLocals,
	getAnalyticsConfig,
	getBooknavConfig,
	getCommentConfig,
	getDynamicConfig,
	getEffectsConfig,
	getLicenseConfig,
	getMermaidConfig,
	getMusicConfig,
	getPanelConfig,
	getProfileConfig,
	getSidebarConfig,
	getSiteConfig,
	getSponsorConfig,
	getWallpaperConfig,
} from "@shared/config/runtime";

export const siteConfig = getSiteConfig(defaultsLocals);
export const sidebarLayoutConfig = getSidebarConfig(defaultsLocals);
export const backgroundWallpaper = getWallpaperConfig(defaultsLocals);
export const displaySettingsConfig = getPanelConfig(defaultsLocals);
export const profileConfig = getProfileConfig(defaultsLocals);
export const commentConfig = getCommentConfig(defaultsLocals);
export const musicPlayerConfig = getMusicConfig(defaultsLocals);
export const sakuraConfig = getEffectsConfig(defaultsLocals);
export const licenseConfig = getLicenseConfig(defaultsLocals);
export const sponsorConfig = getSponsorConfig(defaultsLocals);
export const dynamicConfig = getDynamicConfig(defaultsLocals);
export const mermaidConfig = getMermaidConfig(defaultsLocals);
export const analyticsConfig = getAnalyticsConfig(defaultsLocals);

const booknavDefaults = getBooknavConfig(defaultsLocals);
export const booknavConfig = booknavDefaults.groups;

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

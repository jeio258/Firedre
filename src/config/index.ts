export { analyticsConfig } from "@shared/config/analyticsConfig";
export { announcementConfig } from "@shared/config/announcementConfig";
export { backgroundWallpaper } from "@shared/config/backgroundWallpaper";
export { booknavConfig, booknavPageConfig } from "@shared/config/booknavConfig";
export { commentConfig } from "@shared/config/commentConfig";
export { coverImageConfig } from "@shared/config/coverImageConfig";
export { displaySettingsConfig } from "@shared/config/displaySettingsConfig";
export { dynamicConfig } from "@shared/config/dynamicConfig";
export { sakuraConfig } from "@shared/config/effectsConfig";
export { expressiveCodeConfig } from "@shared/config/expressiveCodeConfig";
export { fontConfig, fontsList } from "@shared/config/fontConfig";
export { footerConfig } from "@shared/config/footerConfig";
export { friendsPageConfig } from "@shared/config/friendsConfig";
export { licenseConfig } from "@shared/config/licenseConfig";
export { mermaidConfig } from "@shared/config/mermaidConfig";
export { musicPlayerConfig } from "@shared/config/musicConfig";
export { navBarConfig } from "@shared/config/navBarConfig";
export { plantumlConfig } from "@shared/config/plantumlConfig";
export { profileConfig } from "@shared/config/profileConfig";
export { sidebarLayoutConfig } from "@shared/config/sidebarConfig";
export { siteConfig } from "@shared/config/siteConfig";

import { getNavbarConfigFromWindow } from "@shared/config/runtime";
import { siteConfig } from "@shared/config/siteConfig";
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
export { sponsorConfig } from "@shared/config/sponsorConfig";
export type {
	AdConfig,
	AnalyticsConfig,
	AnnouncementConfig,
	BackgroundWallpaperConfig,
	BooknavFaviconConfig,
	BooknavGroup,
	BooknavItem,
	BooknavPageConfig,
	CommentConfig,
	CoverImageConfig,
	DisplaySettingsConfig,
	DynamicConfig,
	ExpressiveCodeConfig,
	FooterConfig,
	LicenseConfig,
	MermaidConfig,
	MusicPlayerConfig,
	NavBarConfig,
	PlantUMLConfig,
	ProfileConfig,
	SakuraConfig,
	SidebarLayoutConfig,
	SiteConfig,
	SponsorConfig,
	SponsorItem,
	WidgetComponentConfig,
	WidgetComponentType,
	WidgetSpecificConfig,
} from "../types/config";
export type {
	BuiltinFontProvider,
	CustomFontProvider,
	FontDefinition,
	FontSelectionConfig,
} from "../types/fontConfig";

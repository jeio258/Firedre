// layout 域 getter（B4 自 runtime.ts 机械拆分，逻辑零改动）
import type { FooterConfig } from "@/types/config";
import type {
	NavBarConfig,
	NavBarLink,
	NavbarMode,
} from "@/types/navBarConfig";
import type { SidebarLayoutConfig } from "@/types/sidebarConfig";
import {
	arr,
	bool,
	DEFAULT_NAV_ITEMS,
	groupOf,
	settingsOf,
	str,
} from "./helpers";

export function getNavbarConfig(locals: unknown): NavBarConfig {
	const s = settingsOf(locals);
	const n = groupOf(s, "nav");
	const nb = groupOf(s, "navbar");
	const navItems = arr(n.navItems, DEFAULT_NAV_ITEMS);
	return {
		links: (Array.isArray(navItems) && navItems.length
			? (navItems as Array<Record<string, unknown>>).map((item) => ({
					name: String(item.label ?? item.name ?? ""),
					url: String(item.url ?? "#"),
					...(item.icon ? { icon: String(item.icon) } : {}),
					...(Array.isArray(item.children) &&
					(item.children as unknown[]).length
						? { children: item.children as NavBarLink[] }
						: {}),
					...(item.pageKey ? { pageKey: String(item.pageKey) } : {}),
					...(item.external ? { external: Boolean(item.external) } : {}),
				}))
			: DEFAULT_NAV_ITEMS) as NavBarLink[],
		enabled: bool(n.enabled, true),
		title: str(n.title ?? nb.title, String(nb.title ?? "")),
		widthFull: bool(n.widthFull ?? nb.widthFull, Boolean(nb.widthFull)),
		menuAlign: str(
			n.menuAlign ?? nb.menuAlign,
			String(nb.menuAlign ?? "center"),
		),
		followTheme: bool(n.followTheme ?? nb.followTheme, Boolean(nb.followTheme)),
		stickyNavbar: bool(
			n.stickyNavbar ?? nb.stickyNavbar,
			Boolean((nb.stickyNavbar as boolean) ?? true),
		),
		navbarMode: ((): NavbarMode => {
			const rm = n.navbarMode ?? nb.navbarMode;
			if (rm === "static" || rm === "fixed" || rm === "dynamic") return rm;
			// 兼容旧 stickyNavbar：true→fixed，false→static
			return bool(
				n.stickyNavbar ?? nb.stickyNavbar,
				Boolean((nb.stickyNavbar as boolean) ?? true),
			)
				? "fixed"
				: "static";
		})(),
		logo: (nb.logo && typeof nb.logo === "object"
			? nb.logo
			: undefined) as unknown,
	};
}

export function getSidebarConfig(locals: unknown): SidebarLayoutConfig {
	const s = settingsOf(locals);
	const sb = groupOf(s, "sidebar");
	return {
		...(sb as Record<string, unknown>),
		...(typeof sb.hideSidebarOnPostPage === "boolean"
			? { hideSidebarOnPostPage: sb.hideSidebarOnPostPage }
			: {}),
		...(typeof sb.noSidebarContentWidth === "number"
			? { noSidebarContentWidth: sb.noSidebarContentWidth }
			: {}),
		showProfile: bool(sb.showProfile, true),
		showAnnouncement: bool(sb.showAnnouncement, true),
		showMusic: bool(sb.showMusic, true),
		showCategories: bool(sb.showCategories, true),
		showTags: bool(sb.showTags, true),
		showCalendar: bool(sb.showCalendar, true),
		showDynamic: bool(sb.showDynamic, true),
		showSiteInfo: bool(sb.showSiteInfo, true),
		showStats: bool(sb.showStats, true),
		showAdvertisement: bool(sb.showAdvertisement, true),
		showHitokoto: bool(groupOf(s, "hitokoto").enable, true),
	} as SidebarLayoutConfig;
}

export function getFooterConfig(locals: unknown): FooterConfig {
	const s = settingsOf(locals);
	const f = groupOf(s, "footer");
	return {
		enable: bool(f.enable, false),
		...(typeof f.text === "string" && f.text ? { text: f.text } : {}),
		...(typeof f.icp === "string" && f.icp ? { icp: f.icp } : {}),
		...(typeof f.startYear === "string" && f.startYear
			? { startYear: f.startYear }
			: {}),
		...(typeof f.customHtml === "string" && f.customHtml
			? { customHtml: f.customHtml }
			: {}),
	};
}

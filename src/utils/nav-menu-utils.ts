import {
	listEnabledSiteLinks,
	type SiteLinkView,
} from "@server/siteLinks/service";
import { getNavbarConfig, getSiteConfig } from "@/config/runtime";
import type { NavBarLink } from "@/types/config";
import { resolveNavbarLinks } from "@/utils/navbar-i18n";
import { cfEnv } from "../lib/api";

/**
 * 解析导航栏链接：静态导航配置 + D1 站点外链合并（"链接"分组）+ 页面开关过滤
 * （后台站点设置可覆盖）+ i18n 名称解析。Navbar 桌面下拉与移动端抽屉共用。
 */
export async function resolveNavMenuLinks(
	locals: App.Locals,
): Promise<NavBarLink[]> {
	const navbarConfig = getNavbarConfig(locals);
	const siteConfigRuntime = getSiteConfig(locals);

	// D1 站点外链作为"链接"分组的子项合并
	const navbarLinks = await listEnabledSiteLinks(cfEnv, "navbar", locals);
	const navbarLinkChildren: NavBarLink[] = navbarLinks.map(
		(l: SiteLinkView) => ({
			name: l.name,
			url: l.url,
			icon: l.icon || undefined,
			external: /^https?:\/\//i.test(l.url),
		}),
	);

	// 按页面开关过滤导航栏链接（后台站点设置可覆盖页面开关）
	const pages = siteConfigRuntime.pages;
	const pageSettings =
		(locals as { settings?: Record<string, unknown> }).settings ?? {};
	const pageKeyMap: Record<string, string> = {
		friends: "pageFriends",
		guestbook: "pageGuestbook",
		dynamic: "pageDynamic",
		gallery: "pageGallery",
		booknav: "pageBooknav",
		bilibili: "pageBilibili",
		bangumi: "pageBangumi",
		vndb: "pageVndb",
		mal: "pageMal",
		sponsor: "pageSponsor",
	};

	function isPageEnabled(link: NavBarLink): boolean {
		if (!link.pageKey) return true;
		const overrideKey = pageKeyMap[link.pageKey];

		if (overrideKey && typeof pageSettings[overrideKey] === "boolean")
			return pageSettings[overrideKey] as boolean;

		const groupVal = (
			pageSettings[link.pageKey] as { enabled?: unknown } | undefined
		)?.enabled;
		if (typeof groupVal === "boolean") return groupVal;
		return pages[link.pageKey as keyof typeof pages] !== false;
	}

	function filterLinks(link: NavBarLink): NavBarLink | null {
		if (!link.children) {
			return isPageEnabled(link) ? link : null;
		}

		const filteredChildren = link.children.filter(isPageEnabled);

		if (filteredChildren.length === 0) return null;
		if (filteredChildren.length === 1) return filteredChildren[0];
		return { ...link, children: filteredChildren };
	}

	const sourceLinks = Array.isArray(
		(navbarConfig as unknown as { links?: unknown }).links,
	)
		? ((
				navbarConfig as unknown as {
					links?: Array<{
						label?: string;
						url?: string;
						icon?: string;
						name?: string;
					}>;
				}
			).links as NavBarLink[])
		: [];

	const sourceLinksWithSiteLinks =
		navbarLinkChildren.length > 0
			? sourceLinks.map((link) =>
					link.name === "链接"
						? { ...link, children: navbarLinkChildren }
						: link,
				)
			: sourceLinks;

	return resolveNavbarLinks(
		sourceLinksWithSiteLinks
			.map(filterLinks)
			.filter((link: NavBarLink | null): link is NavBarLink => link !== null),
	);
}

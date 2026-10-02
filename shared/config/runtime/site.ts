// site 域 getter（B4 自 runtime.ts 机械拆分，逻辑零改动）
import type { SiteConfig } from "../../../src/types/siteConfig";
import { normalizeSiteUrl } from "../../utils/url-utils";
import {
	arr,
	bool,
	defaultsLocals,
	groupOf,
	num,
	settingsOf,
	str,
} from "./helpers";

export function getSiteConfig(locals: unknown): SiteConfig {
	const s = settingsOf(locals);
	const p = groupOf(s, "post");
	const pl = groupOf(s, "postListLayout");
	const basic = groupOf(s, "basic");
	return {
		title: str(basic.title, ""),
		lang: str(basic.lang, "zh_CN") as SiteConfig["lang"],
		subtitle: str(basic.subtitle, ""),
		description: str(basic.description, ""),
		site_url: normalizeSiteUrl(str(basic.siteUrl, "")),
		siteStartDate: str(basic.siteStartDate, ""),
		timezone: str(basic.timezone, ""),
		pageWidth: num(basic.pageWidth, 100),
		categoryBar: bool(basic.categoryBar, true),
		categoryStyle: str(
			basic.categoryStyle,
			"rectangle",
		) as SiteConfig["categoryStyle"],
		tagStyle: str(basic.tagStyle, "pill") as SiteConfig["tagStyle"],
		keywords: String(basic.keywords ?? "")
			.split(/[,，]/)
			.map((k) => k.trim())
			.filter(Boolean),
		themeColor: {
			hue: num(basic.hue, 165),
			defaultMode: str(
				basic.defaultMode,
				"system",
			) as SiteConfig["themeColor"]["defaultMode"],
		},
		pages: {
			friends: bool(s.pageFriends, true),
			guestbook: bool(s.pageGuestbook, true),
			dynamic: bool(s.pageDynamic, true),
			gallery: bool(s.pageGallery, true),
			booknav: bool(s.pageBooknav, true),
			bilibili: bool(s.pageBilibili, true),
			bangumi: bool(s.pageBangumi, false),
			vndb: bool(s.pageVndb, false),
			mal: bool(s.pageMal, true),
			sponsor: bool(s.pageSponsor, true),
		},
		foldArticle: bool(basic.foldArticle, true),
		postListLayout: {
			...(basic.postListLayout as SiteConfig["postListLayout"]),
			...(typeof pl === "object" && pl ? (pl as Record<string, unknown>) : {}),
		},
		pagination: basic.pagination as SiteConfig["pagination"],
		post: {
			showLastModified: bool(p.showLastModified, true),
			outdatedThreshold: num(p.outdatedThreshold, 30),
			share: bool(p.share, true),
			postNavigation: bool(p.postNavigation, true),
			relatedPosts: bool(p.relatedPosts, true),
			randomPosts: bool(p.randomPosts, true),
			generateOgImages: bool(p.generateOgImages, false),
			rehypeCallouts:
				(p.rehypeCallouts as SiteConfig["post"]["rehypeCallouts"]) ?? {
					theme: "github",
					enablePythonMarkdownAdmonitions: false,
				},
		},
		card: {
			border: bool(basic.cardBorder, false),
			followTheme: bool(basic.cardFollowTheme, false),
			radius: num(basic.cardRadius, 1),
		},
		favicon: basic.favicon as SiteConfig["favicon"],
		navbar: basic.navbar as SiteConfig["navbar"],
		imageOptimization:
			basic.imageOptimization as SiteConfig["imageOptimization"],
		bilibili: basic.bilibili as SiteConfig["bilibili"],
		bangumi: basic.bangumi as SiteConfig["bangumi"],
		vndb: basic.vndb as SiteConfig["vndb"],
		mal: basic.mal as SiteConfig["mal"],
	};
}

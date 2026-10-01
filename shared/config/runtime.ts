/**
 * 运行时配置层（总指令：动态为唯一主路径）。
 * 取值优先级：D1 后台设置（动态主路径）→ settings-defaults（运行时默认）→
 * 静态 siteConfig（**仅极端兜底**：D1 不可用/未配置时）。禁止把静态兜底当作主路径。
 */

import type { BackgroundWallpaperConfig } from "@/types/backgroundWallpaper";
import type { BooknavFaviconConfig, BooknavGroup } from "@/types/booknavConfig";
import type {
	AnalyticsConfig,
	AnnouncementConfig,
	CommentConfig,
	CoverImageConfig,
	DynamicConfig,
	ExpressiveCodeConfig,
	FontSelectionConfig,
	FooterConfig,
	LicenseConfig,
	MermaidConfig,
	MusicPlayerConfig,
	PlantUMLConfig,
	ProfileConfig,
	SakuraConfig,
	SponsorConfig,
} from "@/types/config";
import type { DisplaySettingsConfig } from "@/types/displaySettingsConfig";
import type {
	NavBarConfig,
	NavBarLink,
	NavbarMode,
} from "@/types/navBarConfig";
import type { SidebarLayoutConfig } from "@/types/sidebarConfig";
import type { SponsorItem } from "@/types/sponsorConfig";
import type { SiteConfig } from "../../src/types/siteConfig";
import { settingsDefaults } from "./settings-defaults";

// 导航 links 默认模板：单一默认源（defaults.nav.navItems）解析，替代静态 navBarConfig
const DEFAULT_NAV_ITEMS: NavBarLink[] = (() => {
	try {
		return JSON.parse(
			(settingsDefaults.nav as { navItems: string }).navItems,
		) as NavBarLink[];
	} catch {
		return [];
	}
})();

// 书签导航默认 groups/favicon：单一默认源（defaults.bookmarks）解析，替代静态 booknavConfig
const DEFAULT_BOOKNAV_GROUPS: BooknavGroup[] = (() => {
	try {
		return JSON.parse(
			(settingsDefaults.bookmarks as { groups: string }).groups,
		) as BooknavGroup[];
	} catch {
		return [];
	}
})();
const DEFAULT_BOOKNAV_FAVICON = (() => {
	try {
		return JSON.parse(
			(settingsDefaults.bookmarks as { favicon: string }).favicon,
		) as BooknavFaviconConfig;
	} catch {
		return {} as BooknavFaviconConfig;
	}
})();

import { normalizeSiteUrl } from "../utils/url-utils";

export type SettingsLike = Record<string, unknown>;

function settingsOf(locals: unknown): SettingsLike {
	const s = ((locals as { settings?: unknown } | null | undefined)?.settings ??
		{}) as SettingsLike;
	return s ?? {};
}

function groupOf(s: SettingsLike, key: string): SettingsLike {
	const g = s[key];
	return (g && typeof g === "object" ? g : {}) as SettingsLike;
}

function str<T extends string>(v: unknown, fallback: T): T {
	return (typeof v === "string" && v !== "" ? v : fallback) as T;
}

function num<T extends number>(v: unknown, fallback: T): T {
	return (typeof v === "number" && Number.isFinite(v) ? v : fallback) as T;
}
function bool<T extends boolean>(v: unknown, fallback: T): T {
	if (typeof v === "boolean") return v as T;
	if (v === "true" || v === "false") return (v === "true") as T;
	return fallback;
}
function arr(v: unknown, fallback: unknown[]): unknown[] {
	if (Array.isArray(v)) return v;
	if (typeof v === "string") {
		try {
			const p = JSON.parse(v);
			if (Array.isArray(p)) return p;
		} catch {}
	}
	return fallback;
}

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

export function getBooknavConfig(locals: unknown) {
	const s = settingsOf(locals);
	const bm = groupOf(s, "bookmarks");
	const groupsRaw = bm.groups;
	let groups: BooknavGroup[] = [];
	if (typeof groupsRaw === "string" && groupsRaw.trim()) {
		try {
			groups = JSON.parse(groupsRaw) as BooknavGroup[];
		} catch {
			groups = [];
		}
	} else if (Array.isArray(groupsRaw)) {
		groups = groupsRaw as BooknavGroup[];
	}
	if (!groups || groups.length === 0) {
		groups = DEFAULT_BOOKNAV_GROUPS;
	}
	let favicon = DEFAULT_BOOKNAV_FAVICON;
	const favRaw = bm.favicon;
	if (typeof favRaw === "string" && favRaw.trim()) {
		try {
			favicon = JSON.parse(favRaw) as BooknavFaviconConfig;
		} catch {}
	} else if (favRaw && typeof favRaw === "object") {
		favicon = favRaw as BooknavFaviconConfig;
	}
	return {
		title: str(
			bm.title ?? s.title,
			String((settingsDefaults.bookmarks as { title?: string }).title ?? ""),
		),
		description: str(
			bm.description ?? s.description,
			String(
				(settingsDefaults.bookmarks as { description?: string }).description ??
					"",
			),
		),
		groups,
		favicon,
	};
}

export function getProfileConfig(locals: unknown): ProfileConfig {
	const s = settingsOf(locals);
	const pr = groupOf(s, "profile");
	return {
		avatar: str(pr.avatar ?? s.avatar, "assets/images/avatar.avif"),
		name: str(pr.name ?? s.name, "Firefly"),
		bio: str(pr.bio ?? s.bio, "Hello, I'm Firefly."),
		location: str(pr.location ?? s.location, ""),
		email: str(pr.email ?? s.email, ""),
		links: arr(pr.links ?? s.links, []) as ProfileConfig["links"],
	};
}

export function getCommentConfig(locals: unknown): CommentConfig {
	const s = settingsOf(locals);
	const c = groupOf(s, "comment");
	return {
		enable: bool(c.enabled, true),
		type: str(c.type, "none"),
		giscus: {
			repo: str(c.giscusRepo, "jeio258/Firedre"),
			repoId: str(c.giscusRepoId, "R_kgD2gfdFGd"),
			category: str(c.giscusCategory, "General"),
			categoryId: str(c.giscusCategoryId, "DIC_kwDOKy9HOc4CegmW"),
			mapping: "title",
			strict: "0",
			reactionsEnabled: "1",
			emitMetadata: "1",
			inputPosition: "top",
			lang: "zh-CN",
			loading: "lazy",
		},
		twikoo: {
			envId: str(c.twikooEnvId, "https://twikoo.vercel.app"),
			jsUrl: str(
				c.twikooJsUrl,
				"https://cdn.jsdelivr.net/npm/twikoo@1.7.14/dist/twikoo.min.js",
			),
			lang: "zh-CN",
			cssUrl: "/assets/css/twikoo-custom.css",
			visitorCount: bool(c.twikooVisitorCount, true),
		},
		waline: {
			serverURL: str(c.walineServer, "https://waline.vercel.app"),
			lang: "zh-CN",
			emoji: [
				"https://unpkg.com/@waline/emojis@1.4.0/weibo",
				"https://unpkg.com/@waline/emojis@1.4.0/bilibili",
				"https://unpkg.com/@waline/emojis@1.4.0/bmoji",
			],
			login: "enable",
			visitorCount: bool(c.walineVisitorCount, true),
		},
		disqus: {
			shortname: str(c.disqusShortname, "firefly"),
		},
		artalk: {
			server: str(c.artalkServer, "https://artalk.example.com/"),
			siteName: str(c.artalkSiteName, ""),
			locale: "zh-CN",
			visitorCount: bool(c.artalkVisitorCount, true),
		},
	};
}

export function getMusicConfig(locals: unknown): MusicPlayerConfig {
	const s = settingsOf(locals);
	const m = groupOf(s, "music");
	return {
		enable: bool(m.enabled, true),
		showInNavbar: bool(m.showInNavbar, true),
		showInSidebar: bool(m.showInSidebar, true),
		autoplay: bool(m.autoplay, false),
		sourceScript: str(m.sourceScript, "kh-v1.7.16"),
		mode: str(m.mode, "local") as "meting" | "local",
		volume: num(m.volume, 0.7),
		playMode: str(m.playMode, "list") as "list" | "one" | "random",
		showLyrics: bool(m.showLyrics, false),
		meting: {
			api: str(
				m.metingApi,
				"https://api.i-meto.com/meting/api?server=:server&type=:type&id=:id&r=:r",
			),
			server: str(m.metingServer, "netease"),
			type: str(m.metingType, "playlist"),
			id: str(m.metingId, "10046455237"),
			auth: str(m.metingAuth, ""),
			fallbackApis: arr(m.metingFallbackApis, []).map(String),
		},
		local: {
			playlist: arr(m.localPlaylist, []) as NonNullable<
				MusicPlayerConfig["local"]
			>["playlist"],
		},
	};
}

export function getWallpaperConfig(locals: unknown) {
	const s = settingsOf(locals);
	const t = groupOf(s, "theme");
	const wb = (t.wallpaperBase ?? {}) as BackgroundWallpaperConfig;
	// 外链壁纸走同源代理：服务端定型随机图（跟 302）并边缘缓存，
	// preload 与渲染同 URL 单次下载，避免随机 API 慢回源拖垮首屏
	const proxiedWallpaper = (u: string, w: number) =>
		/^https:\/\//.test(u)
			? `/api/cover-proxy/?u=${encodeURIComponent(u)}&w=${w}&f=webp`
			: u;
	return {
		...wb,
		mode: str(t.mode, wb.mode ?? "banner") as BackgroundWallpaperConfig["mode"],
		playerEnable: bool(t.playerEnable, wb.playerEnable ?? true),
		src: {
			...(typeof wb.src === "object" && !Array.isArray(wb.src) ? wb.src : {}),
			...(typeof t.bannerUrl === "string" && t.bannerUrl
				? {
						desktop: t.bannerUrl
							.split(",")
							.map((x: string) => proxiedWallpaper(x.trim(), 1920))
							.filter(Boolean),
					}
				: {}),
			...(typeof t.mobileImages === "string" && t.mobileImages
				? {
						mobile: t.mobileImages
							.split(",")
							.map((x: string) => proxiedWallpaper(x.trim(), 828))
							.filter(Boolean),
					}
				: {}),
			...(typeof t.playerUrl === "string" && t.playerUrl
				? {
						playerUrl: t.playerUrl
							.split(",")
							.map((x: string) => x.trim())
							.filter(Boolean),
					}
				: {}),
		},
		common: {
			...(wb.common ?? {}),
			dimOpacity: num(t.dimOpacity, wb.common?.dimOpacity ?? 0),
			playerMode: str(t.playerMode, wb.common?.playerMode ?? "order"),
			homeText: {
				...(wb.common?.homeText ?? {}),
				enable: bool(t.homeTextEnable, wb.common?.homeText?.enable ?? true),
				title: str(t.homeTitle, wb.common?.homeText?.title ?? ""),
				titleSize: str(
					t.homeTitleSize,
					wb.common?.homeText?.titleSize ?? "4.5rem",
				),
				subtitle: (() => {
					if (Array.isArray(t.homeSubtitles)) {
						return t.homeSubtitles.map(String);
					}
					if (typeof t.homeSubtitles === "string") {
						try {
							const parsed = JSON.parse(t.homeSubtitles);
							if (Array.isArray(parsed)) {
								return parsed.map(String);
							}
						} catch {}
					}
					return (
						Array.isArray(wb.common?.homeText?.subtitle)
							? wb.common.homeText.subtitle
							: []
					).map(String);
				})(),
				subtitleSize: str(
					t.homeSubtitleSize,
					wb.common?.homeText?.subtitleSize ?? "1.5rem",
				),
				typewriter: {
					...(wb.common?.homeText?.typewriter ?? {}),
					enable: bool(
						t.typewriter,
						wb.common?.homeText?.typewriter?.enable ?? true,
					),
					speed: num(
						t.typewriterSpeed,
						wb.common?.homeText?.typewriter?.speed ?? 100,
					),
					deleteSpeed: num(
						t.typewriterDeleteSpeed,
						wb.common?.homeText?.typewriter?.deleteSpeed ?? 50,
					),
					pauseTime: num(
						t.typewriterPauseTime,
						wb.common?.homeText?.typewriter?.pauseTime ?? 2000,
					),
				},
			},
			carousel: {
				...(wb.common?.carousel ?? {}),
				enable: bool(t.carousel, wb.common?.carousel?.enable ?? false),
				interval: num(
					t.carouselInterval,
					wb.common?.carousel?.interval ?? 5000,
				),
				transitionEffect: str(
					t.carouselTransition,
					wb.common?.carousel?.transitionEffect ?? "zoom",
				),
			},
		},
		overlay: {
			...(wb.overlay ?? {}),
			opacity: num(t.overlayOpacity, wb.overlay?.opacity ?? 0.8),
			blur: num(t.overlayBlur, wb.overlay?.blur ?? 0),
			cardOpacity: num(t.overlayCardOpacity, wb.overlay?.cardOpacity ?? 0.6),
		},
		banner: {
			...(wb.banner ?? {}),
			navbar: {
				...(wb.banner?.navbar ?? {}),
				transparentMode:
					str(
						(
							t.banner as
								| { navbar?: { transparentMode?: unknown; blur?: unknown } }
								| undefined
						)?.navbar?.transparentMode,
						(
							(wb.banner as unknown as Record<string, unknown>)?.navbar as
								| Record<string, unknown>
								| undefined
						)?.transparentMode as string,
					) ?? "semi",
				blur:
					num(
						(
							t.banner as
								| { navbar?: { transparentMode?: unknown; blur?: unknown } }
								| undefined
						)?.navbar?.blur,
						(
							(wb.banner as unknown as Record<string, unknown>)?.navbar as
								| Record<string, unknown>
								| undefined
						)?.blur as number,
					) ?? 20,
			},
		},
		fullscreen: {
			...(wb.fullscreen ?? {}),
			navbar: {
				...(wb.fullscreen?.navbar ?? {}),
				dynamicTransparent:
					bool(
						(
							t.fullscreen as
								| { navbar?: { dynamicTransparent?: unknown } }
								| undefined
						)?.navbar?.dynamicTransparent,
						(
							(wb.fullscreen as unknown as Record<string, unknown>)?.navbar as
								| Record<string, unknown>
								| undefined
						)?.dynamicTransparent as boolean,
					) ?? true,
			},
		},
	};
}

export function getFooterConfig(locals: unknown): FooterConfig {
	const s = settingsOf(locals);
	const f = groupOf(s, "footer");
	return {
		enable: bool(f.enabled, false),
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

export function getEffectsConfig(locals: unknown): SakuraConfig {
	const s = settingsOf(locals);
	const e = groupOf(s, "effects");
	return {
		enable: bool(e.sakura, false),
		sakuraNum: num(e.sakuraNum, 21),
		limitTimes: num(e.limitTimes, -1),
		size: { min: 0.5, max: 1.1 },
		opacity: { min: 0.3, max: 0.9 },
		speed: {
			horizontal: { min: -1.7, max: -1.2 },
			vertical: { min: 1.5, max: 2.2 },
			rotation: 0.03,
			fadeSpeed: 0.03,
		},
		zIndex: 100,
		waves: bool(e.waves, true),
		gradient: bool(e.gradient, true),
		bannerCarousel: bool(e.bannerCarousel, false),
	};
}

export function getLicenseConfig(locals: unknown): LicenseConfig {
	const s = settingsOf(locals);
	const l = groupOf(s, "license");
	return {
		enable: bool(l.enabled, true),
		name: str(l.name, "CC BY-NC-SA 4.0"),
		type: str(l.type, ""),
		url: str(l.url, "https://creativecommons.org/licenses/by-nc-sa/4.0/"),
		icon: str(l.icon, ""),
	};
}

export function getSponsorConfig(locals: unknown): SponsorConfig {
	const s = settingsOf(locals);
	const sp = groupOf(s, "sponsor");
	const sponsorsVal =
		typeof sp.sponsors === "string"
			? sp.sponsors
			: JSON.stringify((sp.sponsors as SponsorItem[] | undefined) ?? []);
	return {
		title: str(sp.title, ""),
		description: str(sp.description, ""),
		usage: str(
			sp.usage,
			"您的打赏将用于服务器维护、内容创作和功能开发，帮助我持续提供优质内容。",
		),
		showSponsorsList: bool(sp.showSponsorsList, true),
		showComment: true,
		showButtonInPost: bool(sp.showButtonInPost, true),
		sponsors: sponsorsVal as unknown as SponsorItem[],
		enable: bool(sp.enabled, undefined as unknown as boolean),
		...(typeof sp.qrCode === "string" && sp.qrCode
			? { qrCode: sp.qrCode }
			: {}),
	};
}

export function getDynamicConfig(locals: unknown): DynamicConfig {
	const s = settingsOf(locals);
	const d = groupOf(s, "dynamic");
	return {
		enable: bool(d.enabled, undefined as unknown as boolean),
		...(typeof d.title === "string" && d.title ? { title: d.title } : {}),
		...(typeof d.description === "string" && d.description
			? { description: d.description }
			: {}),
		...(typeof d.itemsPerPage === "number"
			? { itemsPerPage: d.itemsPerPage }
			: {}),
		...(typeof d.showComment === "boolean"
			? { showComment: d.showComment }
			: {}),
		...(typeof d.apiUrl === "string" && d.apiUrl ? { apiUrl: d.apiUrl } : {}),
		...(typeof d.profileUrl === "string" && d.profileUrl
			? { profileUrl: d.profileUrl }
			: {}),
		memos: {
			enable: false,
			apiUrl: "https://memos.example.com",
			parent: "users/xiaye",
		},
	};
}

export function getAnnouncementConfig(locals: unknown): AnnouncementConfig {
	const s = settingsOf(locals);
	const a = groupOf(s, "announcement");
	return {
		enable: bool(a.enabled, undefined as unknown as boolean),
		closable: bool(a.closable, true),
		title: str(a.title, ""),
		content: str(a.content, "欢迎来到我的博客！这是一则示例公告。"),
		...(Array.isArray(a.sections) && a.sections.length
			? { sections: a.sections }
			: {}),
		link: {
			enable: true,
			text: "了解更多",
			url: "/about/",
			external: false,
		},
	};
}

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
	} as SidebarLayoutConfig;
}

export function getCoverConfig(locals: unknown): CoverImageConfig {
	const s = settingsOf(locals);
	const c = groupOf(s, "cover");
	let randomCoverImage: CoverImageConfig["randomCoverImage"] = {
		enable: false,
		apis: [
			"https://t.alcy.cc/pc",
			"https://www.dmoe.cc/random.php",
			"https://uapis.cn/api/v1/random/image?category=acg&type=pc",
		],
	};
	if (typeof c.randomCoverImage === "string" && c.randomCoverImage.trim()) {
		try {
			randomCoverImage = JSON.parse(
				c.randomCoverImage,
			) as CoverImageConfig["randomCoverImage"];
		} catch {}
	} else if (c.randomCoverImage && typeof c.randomCoverImage === "object") {
		randomCoverImage =
			c.randomCoverImage as CoverImageConfig["randomCoverImage"];
	}
	return {
		...(typeof c.enable === "boolean" ? { enable: c.enable } : {}),
		...(typeof c.defaultImage === "string" && c.defaultImage
			? { defaultImage: c.defaultImage }
			: {}),
		...(typeof c.configurable === "boolean"
			? { configurable: c.configurable }
			: {}),
		enableInPost: bool(c.enableInPost, true),
		enableInPostOverlay: bool(c.enableInPostOverlay, false),
		showLoading: bool(c.showLoading, false),
		randomCoverImage,
	};
}

export function getFontConfig(locals: unknown): FontSelectionConfig {
	const s = settingsOf(locals);
	const f = groupOf(s, "font");
	return {
		...(typeof f.scale === "number" ? { fontScale: f.scale } : {}),
		enable: bool(f.enable, true),
		...(typeof f.selected === "string" || Array.isArray(f.selected)
			? { selected: f.selected as FontSelectionConfig["selected"] }
			: { selected: ["--font-fangzheng-zizhu"] }),
		...(typeof f.bannerTitleFont === "string" && f.bannerTitleFont
			? { bannerTitleFont: f.bannerTitleFont }
			: { bannerTitleFont: "--font-zen-maru-gothic" }),
		...(typeof f.bannerSubtitleFont === "string" && f.bannerSubtitleFont
			? { bannerSubtitleFont: f.bannerSubtitleFont }
			: { bannerSubtitleFont: "--font-inter" }),
		...(typeof f.navbarTitleFont === "string" && f.navbarTitleFont
			? { navbarTitleFont: f.navbarTitleFont }
			: { navbarTitleFont: "" }),
		...(typeof f.codeFont === "string" && f.codeFont
			? { codeFont: f.codeFont }
			: { codeFont: "--font-jetbrains-mono" }),
	};
}

export function getMermaidConfig(locals: unknown): MermaidConfig {
	const s = settingsOf(locals);
	const m = groupOf(s, "mermaid");
	return {
		enable: bool(m.enabled, true),
		lightTheme: str(m.lightTheme, "editor-light"),
		darkTheme: str(m.darkTheme, "editor-dark"),
	};
}

export function getPlantumlConfig(locals: unknown): PlantUMLConfig {
	const s = settingsOf(locals);
	const p = groupOf(s, "plantuml");
	return {
		enable: bool(p.enable, true),
		server: str(p.server, "https://www.plantuml.com/plantuml"),
		lightTheme: str(p.lightTheme, ""),
		darkTheme: str(p.darkTheme, "cyborg"),
	};
}

export function getAnalyticsConfig(locals: unknown): AnalyticsConfig {
	const s = settingsOf(locals);
	const a = groupOf(s, "analytics");
	return {
		googleAnalyticsId: str(a.googleAnalyticsId, ""),
		microsoftClarityId: str(a.microsoftClarityId, ""),
		umamiAnalytics: {
			websiteId: str(a.umamiId, ""),
			scriptUrl: str(a.umamiUrl, "https://cloud.umami.is/script.js"),
			replaysScriptUrl: "https://cloud.umami.is/recorder.js",
			trackOutboundLinks: true,
			collectWebVitals: false,
			replays: {
				enabled: false,
				sampleRate: 0.15,
				maskLevel: "moderate",
				maxDuration: 300000,
				blockSelector: "",
			},
		},
		la51Analytics: {
			Id: "",
			sdkUrl: "",
			ck: "",
			autoTrack: false,
			hashMode: false,
			screenRecord: true,
		},
	};
}

export function getExpressiveCodeConfig(locals: unknown): ExpressiveCodeConfig {
	const s = settingsOf(locals);
	const ec = groupOf(s, "expressiveCode");
	return {
		darkTheme: str(ec.darkTheme, "one-dark-pro"),
		lightTheme: str(ec.lightTheme, "one-light"),
	};
}

export function getPanelConfig(locals: unknown): DisplaySettingsConfig {
	const s = settingsOf(locals);
	const pn = groupOf(s, "panel");
	return {
		overlaySwitchable: bool(pn.overlaySwitchable, false),
		enable: bool(pn.enable, false),
		themeColorSwitchable: bool(pn.themeColorSwitchable, false),
		layoutSwitchable: bool(pn.layoutSwitchable, false),
		cardBorderSwitchable: bool(pn.cardBorderSwitchable, false),
		cardFollowThemeSwitchable: bool(pn.cardFollowThemeSwitchable, false),
		wallpaperModeSwitchable: bool(pn.wallpaperModeSwitchable, false),
		wavesSwitchable: bool(pn.wavesSwitchable, false),
		gradientSwitchable: bool(pn.gradientSwitchable, false),
		bannerTitleSwitchable: bool(pn.bannerTitleSwitchable, false),
		bannerCarouselSwitchable: bool(pn.bannerCarouselSwitchable, false),
		sakuraSwitchable: bool(pn.sakuraSwitchable, false),
		overlayOpacitySwitchable: bool(pn.overlayOpacitySwitchable, false),
		overlayBlurSwitchable: bool(pn.overlayBlurSwitchable, false),
		overlayCardOpacitySwitchable: bool(pn.overlayCardOpacitySwitchable, false),
	};
}

function windowSettings(): SettingsLike {
	if (typeof window === "undefined") return {};
	return ((window as unknown as { __FIREFLY_SETTINGS__?: SettingsLike })
		.__FIREFLY_SETTINGS__ ?? {}) as SettingsLike;
}

export function getSiteConfigFromWindow() {
	return getSiteConfig({ settings: windowSettings() });
}
export function getEffectsConfigFromWindow() {
	return getEffectsConfig({ settings: windowSettings() });
}
export function getWallpaperConfigFromWindow() {
	return getWallpaperConfig({ settings: windowSettings() });
}
export function getPanelConfigFromWindow() {
	return getPanelConfig({ settings: windowSettings() });
}
export function getNavbarConfigFromWindow() {
	return getNavbarConfig({ settings: windowSettings() });
}
export function getExpressiveCodeConfigFromWindow() {
	return getExpressiveCodeConfig({ settings: windowSettings() });
}

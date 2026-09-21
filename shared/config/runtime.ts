import type { BooknavFaviconConfig, BooknavGroup } from "@/types/booknavConfig";
import type { NavbarMode } from "@/types/navBarConfig";
import type { SponsorItem } from "@/types/sponsorConfig";
import { normalizeSiteUrl } from "../utils/url-utils";
import { analyticsConfig as staticAnalyticsConfig } from "./analyticsConfig";
import { announcementConfig as staticAnnouncementConfig } from "./announcementConfig";
import { backgroundWallpaper as staticWallpaper } from "./backgroundWallpaper";
import {
	booknavConfig as staticBooknavConfig,
	booknavPageConfig as staticBooknavPageConfig,
} from "./booknavConfig";
import { commentConfig as staticCommentConfig } from "./commentConfig";
import { coverImageConfig as staticCoverConfig } from "./coverImageConfig";
import { displaySettingsConfig as staticDisplaySettingsConfig } from "./displaySettingsConfig";
import { dynamicConfig as staticDynamicConfig } from "./dynamicConfig";
import { sakuraConfig as staticEffectsConfig } from "./effectsConfig";
import { expressiveCodeConfig as staticExpressiveCodeConfig } from "./expressiveCodeConfig";
import { fontConfig as staticFontConfig } from "./fontConfig";
import { footerConfig as staticFooterConfig } from "./footerConfig";
import { licenseConfig as staticLicenseConfig } from "./licenseConfig";
import { mermaidConfig as staticMermaidConfig } from "./mermaidConfig";
import { musicPlayerConfig as staticMusicConfig } from "./musicConfig";
import { navBarConfig as staticNavConfig } from "./navBarConfig";
import { live2dWidgetConfig as staticPioConfig } from "./pioConfig";
import { plantumlConfig as staticPlantumlConfig } from "./plantumlConfig";
import { profileConfig as staticProfileConfig } from "./profileConfig";
import { sidebarLayoutConfig as staticSidebarConfig } from "./sidebarConfig";
import { siteConfig as staticSiteConfig } from "./siteConfig";
import { sponsorConfig as staticSponsorConfig } from "./sponsorConfig";

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

export function getSiteConfig(locals: unknown): typeof staticSiteConfig {
	const s = settingsOf(locals);
	const p = groupOf(s, "post");
	const pl = groupOf(s, "postListLayout");
	const basic = groupOf(s, "basic");
	return {
		...staticSiteConfig,
		title: str(
			basic.title ?? s.title,
			String((staticSiteConfig as Record<string, unknown>).title ?? ""),
		),
		lang: str(basic.lang ?? s.lang, staticSiteConfig.lang),
		subtitle: str(
			basic.subtitle ?? s.subtitle,
			String((staticSiteConfig as Record<string, unknown>).subtitle ?? ""),
		),
		description: str(
			basic.description ?? s.description,
			String((staticSiteConfig as Record<string, unknown>).description ?? ""),
		),
		site_url: normalizeSiteUrl(
			str(
				basic.siteUrl ?? s.siteUrl,
				String((staticSiteConfig as Record<string, unknown>).site_url ?? ""),
			),
		),
		siteStartDate: str(
			basic.siteStartDate ?? s.siteStartDate,
			String((staticSiteConfig as Record<string, unknown>).siteStartDate ?? ""),
		),
		timezone: str(
			basic.timezone ?? s.timezone,
			String((staticSiteConfig as Record<string, unknown>).timezone ?? ""),
		),
		pageWidth: num(
			s.pageWidth,
			(staticSiteConfig as Record<string, unknown>).pageWidth as number,
		),
		categoryBar: bool(
			s.categoryBar,
			Boolean((staticSiteConfig as Record<string, unknown>).categoryBar),
		),
		categoryStyle: str(
			s.categoryStyle,
			String((staticSiteConfig as Record<string, unknown>).categoryStyle ?? ""),
		) as typeof staticSiteConfig.categoryStyle,
		tagStyle: str(
			s.tagStyle,
			String((staticSiteConfig as Record<string, unknown>).tagStyle ?? ""),
		) as typeof staticSiteConfig.tagStyle,
		keywords: (() => {
			const raw =
				typeof basic.keywords === "string" && basic.keywords
					? basic.keywords
					: typeof s.keywords === "string" && s.keywords
						? s.keywords
						: Array.isArray(staticSiteConfig.keywords)
							? staticSiteConfig.keywords.join(", ")
							: String(staticSiteConfig.keywords ?? "");
			return raw
				.split(/[,，]/)
				.map((k) => k.trim())
				.filter(Boolean);
		})(),
		themeColor: {
			...staticSiteConfig.themeColor,
			hue: num(
				s.hue,
				(staticSiteConfig.themeColor as Record<string, unknown>).hue as number,
			),
			defaultMode: str(
				s.defaultMode,
				String(
					(staticSiteConfig.themeColor as Record<string, unknown>)
						.defaultMode ?? "",
				),
			) as typeof staticSiteConfig.themeColor.defaultMode,
		},
		pages: {
			friends: bool(s.pageFriends, staticSiteConfig.pages.friends),
			guestbook: bool(s.pageGuestbook, staticSiteConfig.pages.guestbook),
			dynamic: bool(s.pageDynamic, staticSiteConfig.pages.dynamic),
			gallery: bool(s.pageGallery, staticSiteConfig.pages.gallery),
			booknav: bool(s.pageBooknav, staticSiteConfig.pages.booknav),
			bilibili: bool(s.pageBilibili, staticSiteConfig.pages.bilibili),
			bangumi: bool(s.pageBangumi, staticSiteConfig.pages.bangumi),
			vndb: bool(s.pageVndb, staticSiteConfig.pages.vndb),
			mal: bool(s.pageMal, staticSiteConfig.pages.mal),
			sponsor: bool(s.pageSponsor, staticSiteConfig.pages.sponsor),
		},
		foldArticle: bool(
			s.foldArticle,
			staticSiteConfig.foldArticle !== false,
		) as boolean,
		postListLayout: {
			...staticSiteConfig.postListLayout,
			...(typeof pl === "object" && pl ? (pl as Record<string, unknown>) : {}),
		},
		post: {
			...staticSiteConfig.post,
			showLastModified: bool(
				p.showLastModified,
				staticSiteConfig.post.showLastModified,
			),
			outdatedThreshold: num(
				p.outdatedThreshold,
				staticSiteConfig.post.outdatedThreshold,
			),
			sharePoster: bool(p.sharePoster, staticSiteConfig.post.sharePoster),
			generateOgImages: bool(
				p.generateOgImages,
				staticSiteConfig.post.generateOgImages,
			),
			rehypeCallouts: { ...staticSiteConfig.post.rehypeCallouts },
		},
		card: {
			...staticSiteConfig.card,
			border: bool(
				s.cardBorder,
				Boolean((staticSiteConfig.card as Record<string, unknown>).border),
			),
			followTheme: bool(
				s.cardFollowTheme,
				Boolean((staticSiteConfig.card as Record<string, unknown>).followTheme),
			),
			radius: num(
				s.cardRadius,
				Number((staticSiteConfig.card as Record<string, unknown>).radius ?? 1),
			),
		},
		favicon:
			typeof s.faviconUrl === "string" && s.faviconUrl
				? [{ src: s.faviconUrl }]
				: staticSiteConfig.favicon,
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
		groups = staticBooknavConfig;
	}
	let favicon = staticBooknavPageConfig.favicon;
	const favRaw = bm.favicon;
	if (typeof favRaw === "string" && favRaw.trim()) {
		try {
			favicon = JSON.parse(favRaw) as BooknavFaviconConfig;
		} catch {}
	} else if (favRaw && typeof favRaw === "object") {
		favicon = favRaw as BooknavFaviconConfig;
	}
	return {
		title: str(bm.title ?? s.title, staticBooknavPageConfig.title ?? ""),
		description: str(
			bm.description ?? s.description,
			staticBooknavPageConfig.description ?? "",
		),
		groups,
		favicon,
	};
}

export function getProfileConfig(locals: unknown): typeof staticProfileConfig {
	const s = settingsOf(locals);
	const pr = groupOf(s, "profile");
	return {
		...staticProfileConfig,
		name: str(
			pr.name ?? s.name,
			String((staticProfileConfig as Record<string, unknown>).name ?? ""),
		),
		avatar: str(
			pr.avatar ?? s.avatar,
			String((staticProfileConfig as Record<string, unknown>).avatar ?? ""),
		),
		bio: str(
			pr.bio ?? s.bio,
			String((staticProfileConfig as Record<string, unknown>).bio ?? ""),
		),
		location: str(
			pr.location ?? s.location,
			String((staticProfileConfig as Record<string, unknown>).location ?? ""),
		),
		email: str(
			pr.email ?? s.email,
			String((staticProfileConfig as Record<string, unknown>).email ?? ""),
		),
		links: arr(
			pr.links ?? s.links,
			staticProfileConfig.links,
		) as typeof staticProfileConfig.links,
	};
}

export function getCommentConfig(locals: unknown): typeof staticCommentConfig {
	const s = settingsOf(locals);
	const c = groupOf(s, "comment");
	return {
		...staticCommentConfig,
		enable: bool(c.enabled, true),
		type: str(c.type, staticCommentConfig.type),
		giscus: {
			...(staticCommentConfig.giscus ?? {}),
			repo: str(c.giscusRepo, staticCommentConfig.giscus?.repo ?? ""),
			repoId: str(c.giscusRepoId, staticCommentConfig.giscus?.repoId ?? ""),
			category: str(
				c.giscusCategory,
				staticCommentConfig.giscus?.category ?? "",
			),
			categoryId: str(
				c.giscusCategoryId,
				staticCommentConfig.giscus?.categoryId ?? "",
			),
		},
		twikoo: {
			...(staticCommentConfig.twikoo ?? {}),
			envId: str(c.twikooEnvId, staticCommentConfig.twikoo?.envId ?? ""),
			jsUrl: str(c.twikooJsUrl, staticCommentConfig.twikoo?.jsUrl ?? ""),
			visitorCount: bool(
				c.twikooVisitorCount,
				Boolean(
					(staticCommentConfig.twikoo as Record<string, unknown> | undefined)
						?.visitorCount,
				),
			),
		},
		waline: {
			...(staticCommentConfig.waline ?? {}),
			serverURL: str(
				c.walineServer,
				staticCommentConfig.waline?.serverURL ?? "",
			),
			visitorCount: bool(
				c.walineVisitorCount,
				Boolean(
					(staticCommentConfig.waline as Record<string, unknown> | undefined)
						?.visitorCount,
				),
			),
		},
		disqus: {
			...(staticCommentConfig.disqus ?? {}),
			shortname: str(
				c.disqusShortname,
				staticCommentConfig.disqus?.shortname ?? "",
			),
		},
		artalk: {
			...(staticCommentConfig.artalk ?? {}),
			server: str(c.artalkServer, staticCommentConfig.artalk?.server ?? ""),
			siteName: str(
				c.artalkSiteName,
				String(
					(staticCommentConfig.artalk as Record<string, unknown> | undefined)
						?.siteName ?? "",
				),
			),
			visitorCount: bool(
				c.artalkVisitorCount,
				Boolean(
					(staticCommentConfig.artalk as Record<string, unknown> | undefined)
						?.visitorCount,
				),
			),
		},
	};
}

export function getMusicConfig(locals: unknown): typeof staticMusicConfig {
	const s = settingsOf(locals);
	const m = groupOf(s, "music");
	return {
		...staticMusicConfig,
		enable: bool(
			m.enabled,
			(staticMusicConfig as unknown as Record<string, unknown>).enable !==
				false,
		),
		showInNavbar: bool(m.showInNavbar, staticMusicConfig.showInNavbar ?? true),
		showInSidebar: bool(
			m.showInSidebar,
			staticMusicConfig.showInSidebar ?? true,
		),
		autoplay: bool(
			m.autoplay,
			((staticMusicConfig as Record<string, unknown>).autoplay as boolean) ??
				false,
		),
		mode: str(m.mode, (staticMusicConfig.mode ?? "local") as string) as
			| "meting"
			| "local",
		volume: num(m.volume, staticMusicConfig.volume ?? 0.7),
		playMode: str(
			m.playMode,
			(staticMusicConfig.playMode ?? "list") as string,
		) as "list" | "one" | "random",
		showLyrics: bool(m.showLyrics, staticMusicConfig.showLyrics ?? true),
		meting: {
			...(staticMusicConfig.meting ?? {}),
			api: str(m.metingApi, staticMusicConfig.meting?.api ?? ""),
			server: str(
				m.metingServer,
				staticMusicConfig.meting?.server ?? "netease",
			),
			type: str(m.metingType, staticMusicConfig.meting?.type ?? "playlist"),
			id: str(m.metingId, staticMusicConfig.meting?.id ?? ""),
			auth: str(m.metingAuth, staticMusicConfig.meting?.auth ?? ""),
			fallbackApis: arr(
				m.metingFallbackApis,
				staticMusicConfig.meting?.fallbackApis ?? [],
			).map(String),
		},
		local: {
			playlist: arr(
				m.localPlaylist,
				staticMusicConfig.local?.playlist ?? [],
			) as NonNullable<typeof staticMusicConfig.local>["playlist"],
		},
	};
}

export function getWallpaperConfig(locals: unknown) {
	const s = settingsOf(locals);
	const t = groupOf(s, "theme");
	return {
		...staticWallpaper,
		mode: str(
			t.mode,
			(staticWallpaper.mode ?? "banner") as string,
		) as typeof staticWallpaper.mode,
		playerEnable: bool(t.playerEnable, staticWallpaper.playerEnable ?? true),
		src: {
			...(typeof staticWallpaper.src === "object" &&
			!Array.isArray(staticWallpaper.src)
				? staticWallpaper.src
				: {}),
			...(typeof t.bannerUrl === "string" && t.bannerUrl
				? {
						desktop: t.bannerUrl
							.split(",")
							.map((x: string) => x.trim())
							.filter(Boolean),
					}
				: {}),
			...(typeof t.mobileImages === "string" && t.mobileImages
				? {
						mobile: t.mobileImages
							.split(",")
							.map((x: string) => x.trim())
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
			...(staticWallpaper.common ?? {}),
			dimOpacity: num(t.dimOpacity, staticWallpaper.common?.dimOpacity ?? 0),
			playerMode: str(
				t.playerMode,
				staticWallpaper.common?.playerMode ?? "order",
			),
			homeText: {
				...(staticWallpaper.common?.homeText ?? {}),
				enable: bool(
					t.homeTextEnable,
					staticWallpaper.common?.homeText?.enable ?? true,
				),
				title: str(t.homeTitle, staticWallpaper.common?.homeText?.title ?? ""),
				titleSize: str(
					t.homeTitleSize,
					staticWallpaper.common?.homeText?.titleSize ?? "4.5rem",
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
						Array.isArray(staticWallpaper.common?.homeText?.subtitle)
							? staticWallpaper.common.homeText.subtitle
							: []
					).map(String);
				})(),
				subtitleSize: str(
					t.homeSubtitleSize,
					staticWallpaper.common?.homeText?.subtitleSize ?? "1.5rem",
				),
				typewriter: {
					...(staticWallpaper.common?.homeText?.typewriter ?? {}),
					enable: bool(
						t.typewriter,
						staticWallpaper.common?.homeText?.typewriter?.enable ?? true,
					),
					speed: num(
						t.typewriterSpeed,
						staticWallpaper.common?.homeText?.typewriter?.speed ?? 100,
					),
					deleteSpeed: num(
						t.typewriterDeleteSpeed,
						staticWallpaper.common?.homeText?.typewriter?.deleteSpeed ?? 50,
					),
					pauseTime: num(
						t.typewriterPauseTime,
						staticWallpaper.common?.homeText?.typewriter?.pauseTime ?? 2000,
					),
				},
			},
			carousel: {
				...(staticWallpaper.common?.carousel ?? {}),
				enable: bool(
					t.carousel,
					staticWallpaper.common?.carousel?.enable ?? false,
				),
				interval: num(
					t.carouselInterval,
					staticWallpaper.common?.carousel?.interval ?? 5000,
				),
				transitionEffect: str(
					t.carouselTransition,
					staticWallpaper.common?.carousel?.transitionEffect ?? "zoom",
				),
			},
		},
		overlay: {
			...(staticWallpaper.overlay ?? {}),
			opacity: num(t.overlayOpacity, staticWallpaper.overlay?.opacity ?? 0.8),
			blur: num(t.overlayBlur, staticWallpaper.overlay?.blur ?? 0),
			cardOpacity: num(
				t.overlayCardOpacity,
				staticWallpaper.overlay?.cardOpacity ?? 0.6,
			),
		},
		banner: {
			...(staticWallpaper.banner ?? {}),
			navbar: {
				...(staticWallpaper.banner?.navbar ?? {}),
				transparentMode: str(
					(
						t.banner as
							| { navbar?: { transparentMode?: unknown; blur?: unknown } }
							| undefined
					)?.navbar?.transparentMode,
					((
						(staticWallpaper.banner as unknown as Record<string, unknown>)
							?.navbar as Record<string, unknown> | undefined
					)?.transparentMode as string) ?? "semi",
				),
				blur: num(
					(
						t.banner as
							| { navbar?: { transparentMode?: unknown; blur?: unknown } }
							| undefined
					)?.navbar?.blur,
					((
						(staticWallpaper.banner as unknown as Record<string, unknown>)
							?.navbar as Record<string, unknown> | undefined
					)?.blur as number) ?? 20,
				),
			},
		},
		fullscreen: {
			...(staticWallpaper.fullscreen ?? {}),
			navbar: {
				...(staticWallpaper.fullscreen?.navbar ?? {}),
				dynamicTransparent: bool(
					(
						t.fullscreen as
							| { navbar?: { dynamicTransparent?: unknown } }
							| undefined
					)?.navbar?.dynamicTransparent,
					((
						(staticWallpaper.fullscreen as unknown as Record<string, unknown>)
							?.navbar as Record<string, unknown> | undefined
					)?.dynamicTransparent as boolean) ?? true,
				),
			},
		},
	};
}

export function getFooterConfig(locals: unknown): typeof staticFooterConfig {
	const s = settingsOf(locals);
	const f = groupOf(s, "footer");
	return {
		...staticFooterConfig,
		enable: bool(
			f.enabled,
			(staticFooterConfig as Record<string, unknown>).enable as boolean,
		),
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

export function getEffectsConfig(locals: unknown): typeof staticEffectsConfig {
	const s = settingsOf(locals);
	const e = groupOf(s, "effects");
	return {
		...staticEffectsConfig,
		enable: bool(e.sakura, staticEffectsConfig.enable),
		sakuraNum: num(e.sakuraNum, staticEffectsConfig.sakuraNum),
		limitTimes: num(e.limitTimes, staticEffectsConfig.limitTimes),

		waves: bool(e.waves, true),
		gradient: bool(e.gradient, true),
		bannerCarousel: bool(e.bannerCarousel, false),
	};
}

export function getPioConfig(locals: unknown) {
	const s = settingsOf(locals);
	const p = groupOf(s, "pio");
	return {
		...staticPioConfig,
		enable: bool(p.enabled, staticPioConfig.enable),
		...(typeof p.position === "string" && p.position
			? { position: p.position }
			: {}),
		...(typeof p.size === "number" ? { size: p.size } : {}),
		...(typeof p.opacity === "number" ? { opacity: p.opacity } : {}),
		...(typeof p.model === "string" && p.model ? { model: p.model } : {}),
	};
}

export function getLicenseConfig(locals: unknown): typeof staticLicenseConfig {
	const s = settingsOf(locals);
	const l = groupOf(s, "license");
	return {
		...staticLicenseConfig,
		enable: bool(
			l.enabled,
			(staticLicenseConfig as Record<string, unknown>).enable as boolean,
		),
		name: str(
			l.name,
			String((staticLicenseConfig as Record<string, unknown>).name ?? ""),
		),
		type: str(
			l.type,
			String((staticLicenseConfig as Record<string, unknown>).type ?? ""),
		),
		url: str(
			l.url,
			String((staticLicenseConfig as Record<string, unknown>).url ?? ""),
		),
		icon: str(
			l.icon,
			String((staticLicenseConfig as Record<string, unknown>).icon ?? ""),
		),
	};
}

export function getSponsorConfig(locals: unknown): typeof staticSponsorConfig {
	const s = settingsOf(locals);
	const sp = groupOf(s, "sponsor");
	const sponsorsVal =
		typeof sp.sponsors === "string"
			? sp.sponsors
			: JSON.stringify(
					(sp.sponsors as SponsorItem[] | undefined) ??
						staticSponsorConfig.sponsors ??
						[],
				);
	return {
		...staticSponsorConfig,
		sponsors: sponsorsVal as unknown as SponsorItem[],
		enable: bool(
			sp.enabled,
			(staticSponsorConfig as Record<string, unknown>).enable as boolean,
		),
		...(typeof sp.qrCode === "string" && sp.qrCode
			? { qrCode: sp.qrCode }
			: {}),
		showButtonInPost: bool(
			sp.showButtonInPost,
			(staticSponsorConfig as Record<string, unknown>)
				.showButtonInPost as boolean,
		),
		showSponsorsList: bool(
			sp.showSponsorsList,
			(staticSponsorConfig as Record<string, unknown>)
				.showSponsorsList as boolean,
		),
	};
}

export function getDynamicConfig(locals: unknown): typeof staticDynamicConfig {
	const s = settingsOf(locals);
	const d = groupOf(s, "dynamic");
	return {
		...staticDynamicConfig,
		enable: bool(
			d.enabled,
			(staticDynamicConfig as Record<string, unknown>).enable as boolean,
		),
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
		...(d.memos && typeof d.memos === "object"
			? { memos: d.memos as typeof staticDynamicConfig.memos }
			: {}),
	};
}

export function getAnnouncementConfig(
	locals: unknown,
): typeof staticAnnouncementConfig {
	const s = settingsOf(locals);
	const a = groupOf(s, "announcement");
	return {
		...staticAnnouncementConfig,
		enable: bool(
			a.enabled,
			(staticAnnouncementConfig as Record<string, unknown>).enable as boolean,
		),
		closable: bool(a.closable, staticAnnouncementConfig.closable ?? true),
		...(typeof a.title === "string" && a.title ? { title: a.title } : {}),
		...(typeof a.content === "string" && a.content
			? { content: a.content }
			: {}),
		...(Array.isArray(a.sections) && a.sections.length
			? { sections: a.sections }
			: {}),
		...(a.link && typeof a.link === "object"
			? {
					link: a.link as {
						enable?: boolean;
						text?: string;
						url?: string;
						external?: boolean;
					},
				}
			: {}),
	};
}

export function getNavbarConfig(locals: unknown): typeof staticNavConfig {
	const s = settingsOf(locals);
	const n = groupOf(s, "nav");
	const navItems = arr(n.navItems, staticNavConfig.links);
	const nb = groupOf(s, "navbar");
	const siteNavbar = (staticSiteConfig as unknown as Record<string, unknown>)
		.navbar as Record<string, unknown> | undefined;
	return {
		...staticNavConfig,
		enabled: bool(
			n.enabled,
			(staticNavConfig as unknown as Record<string, unknown>).enabled !== false,
		),
		title: str(
			nb.title,
			String(
				(siteNavbar?.title as string) ??
					((staticNavConfig as unknown as Record<string, unknown>)
						.title as string) ??
					"",
			),
		),
		widthFull: bool(nb.widthFull, Boolean(siteNavbar?.widthFull)),
		menuAlign: str(
			nb.menuAlign,
			String((siteNavbar?.menuAlign as string) ?? "center"),
		),
		followTheme: bool(nb.followTheme, Boolean(siteNavbar?.followTheme)),
		stickyNavbar: bool(
			nb.stickyNavbar,
			Boolean((siteNavbar?.stickyNavbar as boolean) ?? true),
		),
		navbarMode: ((): NavbarMode => {
			const rm = nb.navbarMode;
			if (rm === "static" || rm === "fixed" || rm === "dynamic") return rm;
			// 兼容旧 stickyNavbar：true→fixed，false→static
			return bool(
				nb.stickyNavbar,
				Boolean((siteNavbar?.stickyNavbar as boolean) ?? true),
			)
				? "fixed"
				: "static";
		})(),
		logo: (nb.logo && typeof nb.logo === "object"
			? nb.logo
			: siteNavbar?.logo) as unknown,
		links: (Array.isArray(navItems) && navItems.length
			? (navItems as Array<Record<string, unknown>>).map((item) => ({
					name: String(item.label ?? item.name ?? ""),
					url: String(item.url ?? "#"),
					...(item.icon ? { icon: String(item.icon) } : {}),
					...(Array.isArray(item.children) &&
					(item.children as unknown[]).length
						? {
								children:
									item.children as (typeof staticNavConfig.links)[number][],
							}
						: {}),
					...(item.pageKey ? { pageKey: String(item.pageKey) } : {}),
					...(item.external ? { external: Boolean(item.external) } : {}),
				}))
			: staticNavConfig.links) as typeof staticNavConfig.links,
	};
}

export function getSidebarConfig(locals: unknown): typeof staticSidebarConfig {
	const s = settingsOf(locals);
	const sb = groupOf(s, "sidebar");
	return {
		...staticSidebarConfig,
		...(typeof sb.hideSidebarOnPostPage === "boolean"
			? { hideSidebarOnPostPage: sb.hideSidebarOnPostPage }
			: {}),
		...(typeof sb.showBothSidebarsOnPostPage === "boolean"
			? { showBothSidebarsOnPostPage: sb.showBothSidebarsOnPostPage }
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
	};
}

export function getCoverConfig(locals: unknown): typeof staticCoverConfig {
	const s = settingsOf(locals);
	const c = groupOf(s, "cover");
	let randomCoverImage = staticCoverConfig.randomCoverImage;
	if (typeof c.randomCoverImage === "string" && c.randomCoverImage.trim()) {
		try {
			randomCoverImage = JSON.parse(
				c.randomCoverImage,
			) as typeof staticCoverConfig.randomCoverImage;
		} catch {}
	} else if (c.randomCoverImage && typeof c.randomCoverImage === "object") {
		randomCoverImage =
			c.randomCoverImage as typeof staticCoverConfig.randomCoverImage;
	}
	return {
		...staticCoverConfig,
		...(typeof c.enable === "boolean" ? { enable: c.enable } : {}),
		...(typeof c.defaultImage === "string" && c.defaultImage
			? { defaultImage: c.defaultImage }
			: {}),
		...(typeof c.configurable === "boolean"
			? { configurable: c.configurable }
			: {}),
		enableInPost: bool(c.enableInPost, staticCoverConfig.enableInPost),
		enableInPostOverlay: bool(
			c.enableInPostOverlay,
			staticCoverConfig.enableInPostOverlay ?? false,
		),
		showLoading: bool(
			c.showLoading,
			(staticCoverConfig as Record<string, unknown>).showLoading as boolean,
		),
		randomCoverImage,
	};
}

export function getFontConfig(locals: unknown): typeof staticFontConfig {
	const s = settingsOf(locals);
	const f = groupOf(s, "font");
	return {
		...staticFontConfig,
		...(typeof f.scale === "number" ? { fontScale: f.scale } : {}),
		...(typeof f.enable === "boolean" ? { enable: f.enable } : {}),
		...(typeof f.selected === "string" || Array.isArray(f.selected)
			? { selected: f.selected as typeof staticFontConfig.selected }
			: {}),
		...(typeof f.bannerTitleFont === "string" && f.bannerTitleFont
			? { bannerTitleFont: f.bannerTitleFont }
			: {}),
		...(typeof f.bannerSubtitleFont === "string" && f.bannerSubtitleFont
			? { bannerSubtitleFont: f.bannerSubtitleFont }
			: {}),
		...(typeof f.navbarTitleFont === "string" && f.navbarTitleFont
			? { navbarTitleFont: f.navbarTitleFont }
			: {}),
		...(typeof f.codeFont === "string" && f.codeFont
			? { codeFont: f.codeFont }
			: {}),
	};
}

export function getMermaidConfig(locals: unknown): typeof staticMermaidConfig {
	const s = settingsOf(locals);
	const m = groupOf(s, "mermaid");
	return {
		...staticMermaidConfig,
		enable: bool(m.enabled, true),
		lightTheme: str(m.lightTheme, staticMermaidConfig.lightTheme),
		darkTheme: str(m.darkTheme, staticMermaidConfig.darkTheme),
	};
}

export function getPlantumlConfig(
	locals: unknown,
): typeof staticPlantumlConfig {
	const s = settingsOf(locals);
	const p = groupOf(s, "plantuml");
	return {
		...staticPlantumlConfig,
		enable: bool(p.enable, staticPlantumlConfig.enable),
		server: str(p.server, staticPlantumlConfig.server),
		lightTheme: str(p.lightTheme, staticPlantumlConfig.lightTheme),
		darkTheme: str(p.darkTheme, staticPlantumlConfig.darkTheme),
	};
}

export function getAnalyticsConfig(
	locals: unknown,
): typeof staticAnalyticsConfig {
	const s = settingsOf(locals);
	const a = groupOf(s, "analytics");
	return {
		...staticAnalyticsConfig,
		googleAnalyticsId: str(
			a.googleAnalyticsId,
			(staticAnalyticsConfig as Record<string, unknown>)
				.googleAnalyticsId as string,
		),
		microsoftClarityId: str(
			a.microsoftClarityId,
			(staticAnalyticsConfig as Record<string, unknown>)
				.microsoftClarityId as string,
		),
		umamiAnalytics: {
			...(staticAnalyticsConfig.umamiAnalytics ?? {}),
			websiteId: str(
				a.umamiId,
				staticAnalyticsConfig.umamiAnalytics?.websiteId ?? "",
			),
			scriptUrl: str(
				a.umamiUrl,
				staticAnalyticsConfig.umamiAnalytics?.scriptUrl ?? "",
			),
		},
	};
}

export function getExpressiveCodeConfig(
	locals: unknown,
): typeof staticExpressiveCodeConfig {
	const s = settingsOf(locals);
	const ec = groupOf(s, "expressiveCode");
	return {
		...staticExpressiveCodeConfig,
		darkTheme: str(ec.darkTheme, staticExpressiveCodeConfig.darkTheme),
		lightTheme: str(ec.lightTheme, staticExpressiveCodeConfig.lightTheme),
	};
}

export function getPanelConfig(
	locals: unknown,
): typeof staticDisplaySettingsConfig {
	const s = settingsOf(locals);
	const pn = groupOf(s, "panel");
	const d = staticDisplaySettingsConfig as unknown as Record<string, unknown>;
	return {
		overlaySwitchable: staticDisplaySettingsConfig.overlaySwitchable,
		enable: bool(pn.enable, d.enable as boolean),
		themeColorSwitchable: bool(
			pn.themeColorSwitchable,
			d.themeColorSwitchable as boolean,
		),
		layoutSwitchable: bool(pn.layoutSwitchable, d.layoutSwitchable as boolean),
		cardBorderSwitchable: bool(
			pn.cardBorderSwitchable,
			d.cardBorderSwitchable as boolean,
		),
		cardFollowThemeSwitchable: bool(
			pn.cardFollowThemeSwitchable,
			d.cardFollowThemeSwitchable as boolean,
		),
		wallpaperModeSwitchable: bool(
			pn.wallpaperModeSwitchable,
			d.wallpaperModeSwitchable as boolean,
		),
		wavesSwitchable: bool(pn.wavesSwitchable, d.wavesSwitchable as boolean),
		gradientSwitchable: bool(
			pn.gradientSwitchable,
			d.gradientSwitchable as boolean,
		),
		bannerTitleSwitchable: bool(
			pn.bannerTitleSwitchable,
			d.bannerTitleSwitchable as boolean,
		),
		bannerCarouselSwitchable: bool(
			pn.bannerCarouselSwitchable,
			d.bannerCarouselSwitchable as boolean,
		),
		sakuraSwitchable: bool(pn.sakuraSwitchable, d.sakuraSwitchable as boolean),
		overlayOpacitySwitchable: bool(
			pn.overlayOpacitySwitchable,
			d.overlayOpacitySwitchable as boolean,
		),
		overlayBlurSwitchable: bool(
			pn.overlayBlurSwitchable,
			d.overlayBlurSwitchable as boolean,
		),
		overlayCardOpacitySwitchable: bool(
			pn.overlayCardOpacitySwitchable,
			d.overlayCardOpacitySwitchable as boolean,
		),
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
export function getExpressiveCodeConfigFromWindow() {
	return getExpressiveCodeConfig({ settings: windowSettings() });
}

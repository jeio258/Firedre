/**
 * 运行时配置统一入口（Firedre 动态化核心）
 *
 * 设计：与静态 config（src/config/*.ts）**同构**的运行时对象。
 * 组件通过 getXxxConfig(locals) 获取配置——静态值为默认，后台站点设置（D1）
 * 经 middleware 合并进 locals.settings 后实时覆盖。
 *
 * 使用方式（Astro 组件内）：
 *   import { getSiteConfig } from "@/config/runtime";
 *   const siteConfig = getSiteConfig(Astro.locals);
 *   // siteConfig.title 已是运行时值（后台可改、实时生效）
 *
 * 客户端 Svelte 组件用 getXxxConfigFromWindow()（读 window.__FIREFLY_SETTINGS__）。
 */
import { siteConfig as staticSiteConfig } from "./siteConfig";
import { profileConfig as staticProfileConfig } from "./profileConfig";
import { commentConfig as staticCommentConfig } from "./commentConfig";
import { musicPlayerConfig as staticMusicConfig } from "./musicConfig";
import { backgroundWallpaper as staticWallpaper } from "./backgroundWallpaper";
import { live2dWidgetConfig as staticPioConfig } from "./pioConfig";
import { footerConfig as staticFooterConfig } from "./footerConfig";
import { licenseConfig as staticLicenseConfig } from "./licenseConfig";
import { sponsorConfig as staticSponsorConfig } from "./sponsorConfig";
import { dynamicConfig as staticDynamicConfig } from "./dynamicConfig";
import { announcementConfig as staticAnnouncementConfig } from "./announcementConfig";
import { navBarConfig as staticNavConfig } from "./navBarConfig";
import { sidebarLayoutConfig as staticSidebarConfig } from "./sidebarConfig";
import { coverImageConfig as staticCoverConfig } from "./coverImageConfig";
import { fontConfig as staticFontConfig } from "./fontConfig";
import { expressiveCodeConfig as staticExpressiveConfig } from "./expressiveCodeConfig";
import { mermaidConfig as staticMermaidConfig } from "./mermaidConfig";
import { plantumlConfig as staticPlantumlConfig } from "./plantumlConfig";
import { analyticsConfig as staticAnalyticsConfig } from "./analyticsConfig";
import { sakuraConfig as staticEffectsConfig } from "./effectsConfig";
import { displaySettingsConfig as staticDisplaySettingsConfig } from "./displaySettingsConfig";

/** middleware 注入的 settings 形状 */
export type SettingsLike = Record<string, unknown>;

function settingsOf(locals: unknown): SettingsLike {
	const s = ((locals as { settings?: unknown } | null | undefined)?.settings ?? {}) as SettingsLike;
	return s ?? {};
}

/** 后台设置读到的嵌套组（settings.footer / settings.music / …） */
function groupOf(s: SettingsLike, key: string): SettingsLike {
	const g = s[key];
	return (g && typeof g === "object" ? g : {}) as SettingsLike;
}

function str(v: unknown, fallback: string): string {
	return typeof v === "string" && v !== "" ? v : fallback;
}

/**
 * 站点 origin 归一化：后台 site_url 可能填裸域名（www.example.com，无协议），
 * 直接交给 new URL() 会抛 Invalid URL 导致 SSR 渲染崩溃（生产白屏）。
 * 这里为无协议的字符串补全 https://，保证返回合法 origin；已是 http(s) 的保持不变。
 */
function normalizeSiteUrl(raw: string): string {
	if (!raw) return raw;
	if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(raw)) return raw; // 已有协议
	if (raw.startsWith("//")) return `https:${raw}`;
	return `https://${raw}`;
}
function num(v: unknown, fallback: number): number {
	return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}
function bool(v: unknown, fallback: boolean): boolean {
	return typeof v === "boolean" ? v : fallback;
}
function arr(v: unknown, fallback: unknown[]): unknown[] {
	if (Array.isArray(v)) return v;
	if (typeof v === "string") {
		try {
			const p = JSON.parse(v);
			if (Array.isArray(p)) return p;
		} catch { /* ignore */ }
	}
	return fallback;
}

// ─────────────────────────────────────────────
// siteConfig（站点基础）
// ─────────────────────────────────────────────
export function getSiteConfig(locals: unknown) {
	const s = settingsOf(locals);
	const basic = groupOf(s, "basic");
	return {
		...staticSiteConfig,
		title: str(basic.title ?? s.title, String((staticSiteConfig as Record<string, unknown>).title ?? "")),
		subtitle: str(basic.subtitle ?? s.subtitle, String((staticSiteConfig as Record<string, unknown>).subtitle ?? "")),
		description: str(basic.description ?? s.description, String((staticSiteConfig as Record<string, unknown>).description ?? "")),
		site_url: normalizeSiteUrl(
			str(basic.siteUrl ?? s.siteUrl, String((staticSiteConfig as Record<string, unknown>).site_url ?? "")),
		),
		siteStartDate: str(basic.siteStartDate ?? s.siteStartDate, String((staticSiteConfig as Record<string, unknown>).siteStartDate ?? "")),
		timezone: str(basic.timezone ?? s.timezone, String((staticSiteConfig as Record<string, unknown>).timezone ?? "")),
		pageWidth: num(s.pageWidth, (staticSiteConfig as Record<string, unknown>).pageWidth as number),
		categoryBar: bool(s.categoryBar, Boolean((staticSiteConfig as Record<string, unknown>).categoryBar)),
		categoryStyle: str(s.categoryStyle, String((staticSiteConfig as Record<string, unknown>).categoryStyle ?? "")),
		tagStyle: str(s.tagStyle, String((staticSiteConfig as Record<string, unknown>).tagStyle ?? "")),
		keywords: (Array.isArray(staticSiteConfig.keywords) ? staticSiteConfig.keywords : []).map(String),
		themeColor: {
			...staticSiteConfig.themeColor,
			hue: num(s.hue, (staticSiteConfig.themeColor as Record<string, unknown>).hue as number),
			defaultMode: str(s.defaultMode, String((staticSiteConfig.themeColor as Record<string, unknown>).defaultMode ?? "")),
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
		card: {
			...staticSiteConfig.card,
			border: bool(s.cardBorder, Boolean((staticSiteConfig.card as Record<string, unknown>).border)),
			followTheme: bool(s.cardFollowTheme, Boolean((staticSiteConfig.card as Record<string, unknown>).followTheme)),
		},
		favicon: typeof s.faviconUrl === "string" && s.faviconUrl
			? [{ src: s.faviconUrl }]
			: staticSiteConfig.favicon,
	};
}

// ─────────────────────────────────────────────
// profileConfig（个人资料）
// ─────────────────────────────────────────────
export function getProfileConfig(locals: unknown) {
	const s = settingsOf(locals);
	const pr = groupOf(s, "profile");
	return {
		...staticProfileConfig,
		name: str(pr.name ?? s.name, String((staticProfileConfig as Record<string, unknown>).name ?? "")),
		avatar: str(pr.avatar ?? s.avatar, String((staticProfileConfig as Record<string, unknown>).avatar ?? "")),
		bio: str(pr.bio ?? s.bio, String((staticProfileConfig as Record<string, unknown>).bio ?? "")),
		location: str(pr.location ?? s.location, String((staticProfileConfig as Record<string, unknown>).location ?? "")),
		email: str(pr.email ?? s.email, String((staticProfileConfig as Record<string, unknown>).email ?? "")),
		links: arr(pr.links ?? s.links, staticProfileConfig.links),
	};
}

// ─────────────────────────────────────────────
// commentConfig（评论系统）
// ─────────────────────────────────────────────
export function getCommentConfig(locals: unknown) {
	const s = settingsOf(locals);
	const c = groupOf(s, "comment");
	return {
		...staticCommentConfig,
		type: str(c.type, staticCommentConfig.type),
		giscus: {
			...(staticCommentConfig.giscus ?? {}),
			repo: str(c.giscusRepo, staticCommentConfig.giscus?.repo ?? ""),
			repoId: str(c.giscusRepoId, staticCommentConfig.giscus?.repoId ?? ""),
			category: str(c.giscusCategory, staticCommentConfig.giscus?.category ?? ""),
			categoryId: str(c.giscusCategoryId, staticCommentConfig.giscus?.categoryId ?? ""),
		},
		twikoo: {
			...(staticCommentConfig.twikoo ?? {}),
			envId: str(c.twikooEnvId, staticCommentConfig.twikoo?.envId ?? ""),
			jsUrl: str(c.twikooJsUrl, staticCommentConfig.twikoo?.jsUrl ?? ""),
			visitorCount: bool(c.twikooVisitorCount, Boolean((staticCommentConfig.twikoo as Record<string, unknown> | undefined)?.visitorCount)),
		},
		waline: {
			...(staticCommentConfig.waline ?? {}),
			serverURL: str(c.walineServer, staticCommentConfig.waline?.serverURL ?? ""),
			visitorCount: bool(c.walineVisitorCount, Boolean((staticCommentConfig.waline as Record<string, unknown> | undefined)?.visitorCount)),
		},
		disqus: {
			...(staticCommentConfig.disqus ?? {}),
			shortname: str(c.disqusShortname, staticCommentConfig.disqus?.shortname ?? ""),
		},
		artalk: {
			...(staticCommentConfig.artalk ?? {}),
			server: str(c.artalkServer, staticCommentConfig.artalk?.server ?? ""),
			siteName: str(c.artalkSiteName, String((staticCommentConfig.artalk as Record<string, unknown> | undefined)?.siteName ?? "")),
			visitorCount: bool(c.artalkVisitorCount, Boolean((staticCommentConfig.artalk as Record<string, unknown> | undefined)?.visitorCount)),
		},
	};
}

// ─────────────────────────────────────────────
// musicConfig（音乐播放器）
// ─────────────────────────────────────────────
export function getMusicConfig(locals: unknown) {
	const s = settingsOf(locals);
	const m = groupOf(s, "music");
	return {
		...staticMusicConfig,
		enable: bool(m.enabled, (staticMusicConfig as unknown as Record<string, unknown>).enable !== false),
		showInNavbar: bool(m.showInNavbar, staticMusicConfig.showInNavbar ?? true),
		showInSidebar: bool(m.showInSidebar, staticMusicConfig.showInSidebar ?? true),
		autoplay: bool(m.autoplay, (staticMusicConfig as Record<string, unknown>).autoplay as boolean ?? false),
		mode: str(m.mode, (staticMusicConfig.mode ?? "local") as string) as "meting" | "local",
		volume: num(m.volume, staticMusicConfig.volume ?? 0.7),
		playMode: str(m.playMode, (staticMusicConfig.playMode ?? "list") as string) as "list" | "one" | "random",
		showLyrics: bool(m.showLyrics, staticMusicConfig.showLyrics ?? true),
		meting: {
			...(staticMusicConfig.meting ?? {}),
			api: str(m.metingApi, staticMusicConfig.meting?.api ?? ""),
			server: str(m.metingServer, staticMusicConfig.meting?.server ?? "netease"),
			type: str(m.metingType, staticMusicConfig.meting?.type ?? "playlist"),
			id: str(m.metingId, staticMusicConfig.meting?.id ?? ""),
			auth: str(m.metingAuth, staticMusicConfig.meting?.auth ?? ""),
			fallbackApis: arr(m.metingFallbackApis, staticMusicConfig.meting?.fallbackApis ?? []).map(String),
		},
		local: {
			playlist: arr(m.localPlaylist, staticMusicConfig.local?.playlist ?? []),
		},
	};
}

// ─────────────────────────────────────────────
// backgroundWallpaper（背景壁纸）
// ─────────────────────────────────────────────
export function getWallpaperConfig(locals: unknown) {
	const s = settingsOf(locals);
	const t = groupOf(s, "theme");
	return {
		...staticWallpaper,
		mode: str(t.mode, (staticWallpaper.mode ?? "banner") as string) as typeof staticWallpaper.mode,
		playerEnable: bool(t.playerEnable, staticWallpaper.playerEnable ?? true),
		src: {
			...(typeof staticWallpaper.src === "object" && !Array.isArray(staticWallpaper.src) ? staticWallpaper.src : {}),
			...(typeof t.bannerUrl === "string" && t.bannerUrl ? { desktop: t.bannerUrl.split(",").map((x: string) => x.trim()).filter(Boolean) } : {}),
			...(typeof t.mobileImages === "string" && t.mobileImages ? { mobile: t.mobileImages.split(",").map((x: string) => x.trim()).filter(Boolean) } : {}),
			...(typeof t.playerUrl === "string" && t.playerUrl ? { playerUrl: t.playerUrl.split(",").map((x: string) => x.trim()).filter(Boolean) } : {}),
		},
		common: {
			...(staticWallpaper.common ?? {}),
			dimOpacity: num(t.dimOpacity, staticWallpaper.common?.dimOpacity ?? 0),
			playerMode: str(t.playerMode, staticWallpaper.common?.playerMode ?? "order"),
			homeText: {
				...(staticWallpaper.common?.homeText ?? {}),
				enable: bool(t.homeTextEnable, staticWallpaper.common?.homeText?.enable ?? true),
				title: str(t.homeTitle, staticWallpaper.common?.homeText?.title ?? ""),
				titleSize: str(t.homeTitleSize, staticWallpaper.common?.homeText?.titleSize ?? "4.5rem"),
				subtitle: (Array.isArray(staticWallpaper.common?.homeText?.subtitle) ? staticWallpaper.common.homeText.subtitle : []).map(String),
				subtitleSize: str(t.homeSubtitleSize, staticWallpaper.common?.homeText?.subtitleSize ?? "1.5rem"),
				typewriter: {
					...(staticWallpaper.common?.homeText?.typewriter ?? {}),
					enable: bool(t.typewriter, staticWallpaper.common?.homeText?.typewriter?.enable ?? true),
					speed: num(t.typewriterSpeed, staticWallpaper.common?.homeText?.typewriter?.speed ?? 100),
					deleteSpeed: num(t.typewriterDeleteSpeed, staticWallpaper.common?.homeText?.typewriter?.deleteSpeed ?? 50),
					pauseTime: num(t.typewriterPauseTime, staticWallpaper.common?.homeText?.typewriter?.pauseTime ?? 2000),
				},
			},
			carousel: {
				...(staticWallpaper.common?.carousel ?? {}),
				enable: bool(t.carousel, staticWallpaper.common?.carousel?.enable ?? false),
				interval: num(t.carouselInterval, staticWallpaper.common?.carousel?.interval ?? 5000),
				transitionEffect: str(t.carouselTransition, staticWallpaper.common?.carousel?.transitionEffect ?? "zoom"),
			},
		},
		overlay: {
			...(staticWallpaper.overlay ?? {}),
			opacity: num(t.overlayOpacity, staticWallpaper.overlay?.opacity ?? 0.8),
			blur: num(t.overlayBlur, staticWallpaper.overlay?.blur ?? 0),
			cardOpacity: num(t.overlayCardOpacity, staticWallpaper.overlay?.cardOpacity ?? 0.6),
		},
		banner: {
			...(staticWallpaper.banner ?? {}),
			navbar: {
				...(staticWallpaper.banner?.navbar ?? {}),
				transparentMode: str(
					(t.banner as { navbar?: { transparentMode?: unknown; blur?: unknown } } | undefined)?.navbar?.transparentMode,
					((staticWallpaper.banner as unknown as Record<string, unknown>)?.navbar as Record<string, unknown> | undefined)?.transparentMode as string ?? "semi",
				),
				blur: num(
					(t.banner as { navbar?: { transparentMode?: unknown; blur?: unknown } } | undefined)?.navbar?.blur,
					((staticWallpaper.banner as unknown as Record<string, unknown>)?.navbar as Record<string, unknown> | undefined)?.blur as number ?? 20,
				),
			},
		},
		fullscreen: {
			...(staticWallpaper.fullscreen ?? {}),
			navbar: {
				...(staticWallpaper.fullscreen?.navbar ?? {}),
				dynamicTransparent: bool(
					(t.fullscreen as { navbar?: { dynamicTransparent?: unknown } } | undefined)?.navbar?.dynamicTransparent,
					((staticWallpaper.fullscreen as unknown as Record<string, unknown>)?.navbar as Record<string, unknown> | undefined)?.dynamicTransparent as boolean ?? true,
				),
			},
		},
	};
}

// ─────────────────────────────────────────────
// 其余配置（通用模式：扁平标量 + 组对象）
// ─────────────────────────────────────────────
export function getFooterConfig(locals: unknown) {
	const s = settingsOf(locals);
	const f = groupOf(s, "footer");
	return {
		...staticFooterConfig,
		...(typeof f.text === "string" && f.text ? { text: f.text } : {}),
		...(typeof f.icp === "string" && f.icp ? { icp: f.icp } : {}),
		...(typeof f.startYear === "string" && f.startYear ? { startYear: f.startYear } : {}),
		...(typeof f.customHtml === "string" && f.customHtml ? { customHtml: f.customHtml } : {}),
	};
}

export function getEffectsConfig(locals: unknown) {
	const s = settingsOf(locals);
	const e = groupOf(s, "effects");
	return {
		...staticEffectsConfig,
		enable: bool(e.sakura, staticEffectsConfig.enable),
		sakuraNum: num(e.sakuraNum, staticEffectsConfig.sakuraNum),
		limitTimes: num(e.limitTimes, staticEffectsConfig.limitTimes),
		// Firedre：后台 effects 组新增的波浪/渐变/轮播开关（settings-defaults 有默认，SSR 经 getBannerVisibilityState 读取）
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
		...(typeof p.position === "string" && p.position ? { position: p.position } : {}),
		...(typeof p.size === "number" ? { size: p.size } : {}),
		...(typeof p.opacity === "number" ? { opacity: p.opacity } : {}),
		...(typeof p.model === "string" && p.model ? { model: p.model } : {}),
	};
}

export function getLicenseConfig(locals: unknown) {
	const s = settingsOf(locals);
	const l = groupOf(s, "license");
	return {
		...staticLicenseConfig,
		enable: bool(l.enabled, (staticLicenseConfig as Record<string, unknown>).enable as boolean),
		name: str(l.name, String((staticLicenseConfig as Record<string, unknown>).name ?? "")),
		type: str(l.type, String((staticLicenseConfig as Record<string, unknown>).type ?? "")),
		url: str(l.url, String((staticLicenseConfig as Record<string, unknown>).url ?? "")),
		icon: str(l.icon, String((staticLicenseConfig as Record<string, unknown>).icon ?? "")),
	};
}

export function getSponsorConfig(locals: unknown) {
	const s = settingsOf(locals);
	const sp = groupOf(s, "sponsor");
	return {
		...staticSponsorConfig,
		enable: bool(sp.enabled, (staticSponsorConfig as Record<string, unknown>).enable as boolean),
		...(typeof sp.qrCode === "string" && sp.qrCode ? { qrCode: sp.qrCode } : {}),
		showButtonInPost: bool(sp.showButtonInPost, (staticSponsorConfig as Record<string, unknown>).showButtonInPost as boolean),
		showSponsorsList: bool(sp.showSponsorsList, (staticSponsorConfig as Record<string, unknown>).showSponsorsList as boolean),
	};
}

export function getDynamicConfig(locals: unknown) {
	const s = settingsOf(locals);
	const d = groupOf(s, "dynamic");
	return {
		...staticDynamicConfig,
		enable: bool(d.enabled, (staticDynamicConfig as Record<string, unknown>).enable as boolean),
		...(typeof d.title === "string" && d.title ? { title: d.title } : {}),
		...(typeof d.description === "string" && d.description ? { description: d.description } : {}),
		...(typeof d.itemsPerPage === "number" ? { itemsPerPage: d.itemsPerPage } : {}),
		...(typeof d.showComment === "boolean" ? { showComment: d.showComment } : {}),
		...(typeof d.apiUrl === "string" && d.apiUrl ? { apiUrl: d.apiUrl } : {}),
		...(typeof d.profileUrl === "string" && d.profileUrl ? { profileUrl: d.profileUrl } : {}),
	};
}

export function getAnnouncementConfig(locals: unknown) {
	const s = settingsOf(locals);
	const a = groupOf(s, "announcement");
	return {
		...staticAnnouncementConfig,
		enable: bool(a.enabled, (staticAnnouncementConfig as Record<string, unknown>).enable as boolean),
		closable: bool(a.closable, staticAnnouncementConfig.closable ?? true),
		...(typeof a.title === "string" && a.title ? { title: a.title } : {}),
		...(typeof a.content === "string" && a.content ? { content: a.content } : {}),
		...(Array.isArray(a.sections) && a.sections.length ? { sections: a.sections } : {}),
		...(a.link && typeof a.link === "object"
			? { link: a.link as { enable?: boolean; text?: string; url?: string; external?: boolean } }
			: {}),
	};
}

export function getNavbarConfig(locals: unknown) {
	const s = settingsOf(locals);
	const n = groupOf(s, "nav");
	const navItems = arr(n.navItems, staticNavConfig.links);
	const nb = groupOf(s, "navbar");
	const siteNavbar = (staticSiteConfig as unknown as Record<string, unknown>).navbar as Record<string, unknown> | undefined;
	return {
		...staticNavConfig,
		enabled: bool(n.enabled, (staticNavConfig as unknown as Record<string, unknown>).enabled !== false),
		title: str(nb.title, String((siteNavbar?.title as string) ?? ((staticNavConfig as unknown as Record<string, unknown>).title as string) ?? "")),
		widthFull: bool(nb.widthFull, Boolean(siteNavbar?.widthFull)),
		menuAlign: str(nb.menuAlign, String((siteNavbar?.menuAlign as string) ?? "center")),
		followTheme: bool(nb.followTheme, Boolean(siteNavbar?.followTheme)),
		stickyNavbar: bool(nb.stickyNavbar, Boolean((siteNavbar?.stickyNavbar as boolean) ?? true)),
		logo: (nb.logo && typeof nb.logo === "object" ? nb.logo : siteNavbar?.logo) as unknown,
		links: (Array.isArray(navItems) && navItems.length
			? (navItems as Array<Record<string, unknown>>).map((item) => ({
					name: String(item.label ?? item.name ?? ""),
					url: String(item.url ?? "#"),
					...(item.icon ? { icon: String(item.icon) } : {}),
					...(Array.isArray(item.children) && (item.children as unknown[]).length
						? { children: item.children as typeof staticNavConfig.links[number][] }
						: {}),
					...(item.pageKey ? { pageKey: String(item.pageKey) } : {}),
					...(item.external ? { external: Boolean(item.external) } : {}),
				}))
			: staticNavConfig.links) as typeof staticNavConfig.links,
	};
}

export function getSidebarConfig(locals: unknown) {
	const s = settingsOf(locals);
	const sb = groupOf(s, "sidebar");
	return {
		...staticSidebarConfig,
		...(typeof sb.hideSidebarOnPostPage === "boolean" ? { hideSidebarOnPostPage: sb.hideSidebarOnPostPage } : {}),
		...(typeof sb.showBothSidebarsOnPostPage === "boolean" ? { showBothSidebarsOnPostPage: sb.showBothSidebarsOnPostPage } : {}),
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

export function getCoverConfig(locals: unknown) {
	const s = settingsOf(locals);
	const c = groupOf(s, "cover");
	return {
		...staticCoverConfig,
		...(typeof c.enable === "boolean" ? { enable: c.enable } : {}),
		...(typeof c.defaultImage === "string" && c.defaultImage ? { defaultImage: c.defaultImage } : {}),
		...(typeof c.configurable === "boolean" ? { configurable: c.configurable } : {}),
		showLoading: bool(c.showLoading, (staticCoverConfig as Record<string, unknown>).showLoading as boolean),
	};
}

export function getFontConfig(locals: unknown) {
	const s = settingsOf(locals);
	const f = groupOf(s, "font");
	return {
		...staticFontConfig,
		...(typeof f.scale === "number" ? { fontScale: f.scale } : {}),
	};
}

export function getExpressiveConfig(locals: unknown) {
	const s = settingsOf(locals);
	const e = groupOf(s, "expressive");
	return {
		...staticExpressiveConfig,
		darkTheme: str(e.darkTheme, staticExpressiveConfig.darkTheme),
		lightTheme: str(e.lightTheme, staticExpressiveConfig.lightTheme),
	};
}

export function getMermaidConfig(locals: unknown) {
	const s = settingsOf(locals);
	const m = groupOf(s, "mermaid");
	return {
		...staticMermaidConfig,
		lightTheme: str(m.lightTheme, staticMermaidConfig.lightTheme),
		darkTheme: str(m.darkTheme, staticMermaidConfig.darkTheme),
	};
}

export function getPlantumlConfig(locals: unknown) {
	const s = settingsOf(locals);
	const p = groupOf(s, "plantuml");
	return {
		...staticPlantumlConfig,
		...(typeof p.server === "string" && p.server ? { server: p.server } : {}),
	};
}

export function getAnalyticsConfig(locals: unknown) {
	const s = settingsOf(locals);
	const a = groupOf(s, "analytics");
	return {
		...staticAnalyticsConfig,
		googleAnalyticsId: str(a.googleAnalyticsId, (staticAnalyticsConfig as Record<string, unknown>).googleAnalyticsId as string),
		microsoftClarityId: str(a.microsoftClarityId, (staticAnalyticsConfig as Record<string, unknown>).microsoftClarityId as string),
		umamiAnalytics: {
			...(staticAnalyticsConfig.umamiAnalytics ?? {}),
			websiteId: str(a.umamiId, staticAnalyticsConfig.umamiAnalytics?.websiteId ?? ""),
			scriptUrl: str(a.umamiUrl, staticAnalyticsConfig.umamiAnalytics?.scriptUrl ?? ""),
		},
	};
}

// ─────────────────────────────────────────────
// panel（首页设置面板开关）
// ─────────────────────────────────────────────
export function getPanelConfig(locals: unknown) {
	const s = settingsOf(locals);
	const pn = groupOf(s, "panel");
	const d = staticDisplaySettingsConfig as unknown as Record<string, unknown>;
	return {
		enable: bool(pn.enable, d.enable as boolean),
		themeColorSwitchable: bool(pn.themeColorSwitchable, d.themeColorSwitchable as boolean),
		layoutSwitchable: bool(pn.layoutSwitchable, d.layoutSwitchable as boolean),
		cardBorderSwitchable: bool(pn.cardBorderSwitchable, d.cardBorderSwitchable as boolean),
		cardFollowThemeSwitchable: bool(pn.cardFollowThemeSwitchable, d.cardFollowThemeSwitchable as boolean),
		wallpaperModeSwitchable: bool(pn.wallpaperModeSwitchable, d.wallpaperModeSwitchable as boolean),
		wavesSwitchable: bool(pn.wavesSwitchable, d.wavesSwitchable as boolean),
		gradientSwitchable: bool(pn.gradientSwitchable, d.gradientSwitchable as boolean),
		bannerTitleSwitchable: bool(pn.bannerTitleSwitchable, d.bannerTitleSwitchable as boolean),
		bannerCarouselSwitchable: bool(pn.bannerCarouselSwitchable, d.bannerCarouselSwitchable as boolean),
		sakuraSwitchable: bool(pn.sakuraSwitchable, d.sakuraSwitchable as boolean),
		overlayOpacitySwitchable: bool(pn.overlayOpacitySwitchable, d.overlayOpacitySwitchable as boolean),
		overlayBlurSwitchable: bool(pn.overlayBlurSwitchable, d.overlayBlurSwitchable as boolean),
		overlayCardOpacitySwitchable: bool(pn.overlayCardOpacitySwitchable, d.overlayCardOpacitySwitchable as boolean),
	};
}

// ─────────────────────────────────────────────
// 客户端（Svelte）读取：window.__FIREFLY_SETTINGS__（SSR 注入）
// ─────────────────────────────────────────────
function windowSettings(): SettingsLike {
	if (typeof window === "undefined") return {};
	return ((window as unknown as { __FIREFLY_SETTINGS__?: SettingsLike }).__FIREFLY_SETTINGS__ ?? {}) as SettingsLike;
}

export function getSiteConfigFromWindow() {
	return getSiteConfig({ settings: windowSettings() });
}
export function getEffectsConfigFromWindow() {
	return getEffectsConfig({ settings: windowSettings() });
}
export function getMusicConfigFromWindow() {
	return getMusicConfig({ settings: windowSettings() });
}
export function getWallpaperConfigFromWindow() {
	return getWallpaperConfig({ settings: windowSettings() });
}
export function getCommentConfigFromWindow() {
	return getCommentConfig({ settings: windowSettings() });
}
export function getPanelConfigFromWindow() {
	return getPanelConfig({ settings: windowSettings() });
}

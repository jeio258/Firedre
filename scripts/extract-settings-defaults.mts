// 从 Firefly 静态配置提取后台设置字段的完整默认值（生成 src/config/settings-defaults.json）
import { writeFileSync } from "node:fs";

const defaults: Record<string, Record<string, unknown>> = {};

async function load<T>(p: string): Promise<T> {
	return (await import(p)).default as T;
}

// 逐个组提取（含嵌套展平命名）
// ── basic ──
{
	const c: any = (await import("../src/config/siteConfig.ts")).siteConfig;
	defaults.basic = {
		title: c.title,
		subtitle: c.subtitle,
		description: c.description,
		siteUrl: c.site_url,
		siteStartDate: c.siteStartDate,
		timezone: c.timezone,
		pageWidth: c.pageWidth,
		categoryBar: c.categoryBar,
		categoryStyle: c.categoryStyle,
		tagStyle: c.tagStyle,
		hue: c.themeColor?.hue,
		defaultMode: c.themeColor?.defaultMode,
		pageFriends: c.pages?.friends,
		pageGuestbook: c.pages?.guestbook,
		pageDynamic: c.pages?.dynamic,
		pageGallery: c.pages?.gallery,
		pageBooknav: c.pages?.booknav,
		pageBilibili: c.pages?.bilibili,
		pageBangumi: c.pages?.bangumi,
		pageVndb: c.pages?.vndb,
		pageMal: c.pages?.mal,
		pageSponsor: c.pages?.sponsor,
		keywords: c.keywords?.length ? c.keywords.join(",") : "",
	};
}
// ── panel ──
{
	const c: any = (await import("../src/config/displaySettingsConfig.ts"))
		.displaySettingsConfig;
	defaults.panel = {
		enable: c.enable,
		themeColorSwitchable: c.themeColorSwitchable,
		layoutSwitchable: c.layoutSwitchable,
		cardBorderSwitchable: c.cardBorderSwitchable,
		cardFollowThemeSwitchable: c.cardFollowThemeSwitchable,
		wallpaperModeSwitchable: c.wallpaperModeSwitchable,
		wavesSwitchable: c.wavesSwitchable,
		gradientSwitchable: c.gradientSwitchable,
		bannerTitleSwitchable: c.bannerTitleSwitchable,
		bannerCarouselSwitchable: c.bannerCarouselSwitchable,
		sakuraSwitchable: c.sakuraSwitchable,
		overlayOpacity: c.overlaySwitchable?.opacity,
		overlayBlur: c.overlaySwitchable?.blur,
		overlayCardOpacity: c.overlaySwitchable?.cardOpacity,
	};
}
// ── profile ──
{
	const c: any = (await import("../src/config/profileConfig.ts")).profileConfig;
	defaults.profile = {
		name: c.name,
		avatar: c.avatar,
		bio: c.bio,
		location: c.location,
		email: c.email,
		links: c.links?.length ? JSON.stringify(c.links) : "",
	};
}
// ── theme（背景壁纸）──
{
	const c: any = (await import("../src/config/backgroundWallpaper.ts"))
		.backgroundWallpaper;
	const src = c.src ?? {};
	const common = c.common ?? {};
	const homeText = common.homeText ?? {};
	const tw = homeText.typewriter ?? {};
	const carousel = common.carousel ?? {};
	const overlay = c.overlay ?? {};
	const fullscreen = c.fullscreen ?? {};
	defaults.theme = {
		mode: c.mode,
		playerEnable: c.playerEnable,
		bannerUrl: Array.isArray(src.desktop)
			? src.desktop.join(",")
			: (src.desktop ?? ""),
		mobileImages: Array.isArray(src.mobile)
			? src.mobile.join(",")
			: (src.mobile ?? ""),
		playerUrl: Array.isArray(src.playerUrl)
			? src.playerUrl.join(",")
			: (src.playerUrl ?? ""),
		dimOpacity: common.dimOpacity,
		playerMode: common.playerMode,
		homeTextEnable: homeText.enable,
		homeTitle: homeText.title,
		homeTitleSize: homeText.titleSize,
		homeSubtitles: Array.isArray(homeText.subtitle)
			? JSON.stringify(homeText.subtitle)
			: "",
		homeSubtitleSize: homeText.subtitleSize,
		typewriter: tw.enable,
		typewriterSpeed: tw.speed,
		typewriterDeleteSpeed: tw.deleteSpeed,
		typewriterPauseTime: tw.pauseTime,
		carousel: carousel.enable,
		carouselInterval: carousel.interval,
		carouselTransition: carousel.transitionEffect,
		overlayOpacity: overlay.opacity,
		overlayBlur: overlay.blur,
		fullscreenBg: Array.isArray(fullscreen.src)
			? fullscreen.src.join(",")
			: (fullscreen.src ?? ""),
	};
}
// ── nav ──
{
	const c: any = (await import("../src/config/navBarConfig.ts")).navBarConfig;
	defaults.nav = {
		navItems: c.links?.length ? JSON.stringify(c.links) : "",
	};
}
// ── sidebar ──
{
	const c: any = (await import("../src/config/sidebarConfig.ts"))
		.sidebarLayoutConfig;
	defaults.sidebar = {
		hideSidebarOnPostPage: c.hideSidebarOnPostPage,
		showBothSidebarsOnPostPage: c.showBothSidebarsOnPostPage,
	};
}
// ── font ──
{
	const c: any = (await import("../src/config/fontConfig.ts")).fontConfig;
	defaults.font = {
		enable: c.enable,
		bodyFont: c.bodyFont?.name ?? "",
		headingFont: c.headingFont?.name ?? "",
		codeFont: c.codeFont?.name ?? "",
		bannerTitleFont: c.bannerTitleFont?.name ?? "",
		bannerSubtitleFont: c.bannerSubtitleFont?.name ?? "",
		navbarTitleFont: c.navbarTitleFont?.name ?? "",
		scale: c.fontScale,
	};
}
// ── expressive ──
{
	const c: any = (await import("../src/config/expressiveCodeConfig.ts"))
		.expressiveCodeConfig;
	defaults.expressive = {
		theme: c.darkTheme,
		darkTheme: c.darkTheme,
		lightTheme: c.lightTheme,
		showLineNumbers: c.showLineNumbers,
		wrap: c.wrap,
	};
}
// ── comment ──
{
	const c: any = (await import("../src/config/commentConfig.ts")).commentConfig;
	defaults.comment = {
		type: c.type,
		giscusRepo: c.giscus?.repo,
		giscusRepoId: c.giscus?.repoId,
		giscusCategory: c.giscus?.category,
		giscusCategoryId: c.giscus?.categoryId,
		twikooEnvId: c.twikoo?.envId,
		twikooJsUrl: c.twikoo?.jsUrl,
		walineServer: c.waline?.serverURL,
		disqusShortname: c.disqus?.shortname,
		artalkServer: c.artalk?.server,
		artalkSiteName: c.artalk?.siteName,
	};
}
// ── cover ──
{
	const c: any = (await import("../src/config/coverImageConfig.ts"))
		.coverImageConfig;
	defaults.cover = {
		enable: c.enable,
		defaultImage: c.defaultImage,
		configurable: c.configurable,
		fallbackToFirstImage: c.fallbackToFirstImage,
		showLoading: c.showLoading,
		randomCoverImage: c.randomCoverImage,
	};
}
// ── encrypt ──
{
	// 文章加密：无独立 config 文件（加密由文章 frontmatter 控制）
	defaults.encrypt = { enable: true, defaultHint: "请输入密码以阅读本文" };
}
// ── music ──
{
	const c: any = (await import("../src/config/musicConfig.ts"))
		.musicPlayerConfig;
	defaults.music = {
		showInNavbar: c.showInNavbar,
		showInSidebar: c.showInSidebar,
		mode: c.mode,
		volume: c.volume,
		playMode: c.playMode,
		showLyrics: c.showLyrics,
		metingApi: c.meting?.api,
		metingServer: c.meting?.server,
		metingType: c.meting?.type,
		metingId: c.meting?.id,
		metingAuth: c.meting?.auth,
		metingFallbackApis: c.meting?.fallbackApis?.length
			? JSON.stringify(c.meting.fallbackApis)
			: "",
		localPlaylist: c.local?.playlist?.length
			? JSON.stringify(c.local.playlist)
			: "",
	};
}
// ── mermaid ──
{
	const c: any = (await import("../src/config/mermaidConfig.ts")).mermaidConfig;
	defaults.mermaid = {
		enabled: c.enable,
		theme: c.lightTheme,
		lightTheme: c.lightTheme,
		darkTheme: c.darkTheme,
	};
}
// ── plantuml ──
{
	const c: any = (await import("../src/config/plantumlConfig.ts"))
		.plantumlConfig;
	defaults.plantuml = {
		enabled: c.enable,
		server: c.server,
		theme: c.lightTheme,
		lightTheme: c.lightTheme,
		darkTheme: c.darkTheme,
	};
}
// ── dynamic ──
{
	const c: any = (await import("../src/config/dynamicConfig.ts")).dynamicConfig;
	defaults.dynamic = {
		enabled: true,
		title: c.title,
		description: c.description,
		profileUrl: c.profileUrl,
		showComment: c.showComment,
		itemsPerPage: c.itemsPerPage,
		apiUrl: c.apiUrl,
		memosEnable: c.memos?.enable,
		memosApiUrl: c.memos?.apiUrl,
	};
}
// ── friends ──
{
	const c: any = (await import("../src/config/friendsConfig.ts")).friendsConfig;
	defaults.friends = {
		enabled: true,
		title: c.title,
		description: c.description,
		randomOrder: c.randomOrder,
		showCustomContent: c.showCustomContent,
		showComment: c.showComment,
		randomizeSort: c.randomizeSort,
	};
}
// ── gallery ──
{
	const c: any = (await import("../src/config/galleryConfig.ts")).galleryConfig;
	defaults.gallery = {
		enabled: true,
		title: c.title,
		coverStyle: c.coverStyle,
		masonry: c.masonry,
		columnWidth: c.columnWidth,
	};
}
// ── bookmarks ──
{
	const c: any = (await import("../src/config/booknavConfig.ts")).booknavConfig;
	defaults.bookmarks = {
		enabled: c.enable,
		title: c.title,
		description: c.description,
		favicon: c.favicon,
		groups: c.groups?.length ? JSON.stringify(c.groups) : "",
	};
}
// ── sponsor ──
{
	const c: any = (await import("../src/config/sponsorConfig.ts")).sponsorConfig;
	defaults.sponsor = {
		enabled: c.enable,
		title: c.title,
		description: c.description,
		qrCode: c.qrCode,
		showButtonInPost: c.showButtonInPost,
		showSponsorsList: c.showSponsorsList,
	};
}
// ── effects ──
{
	const c: any = (await import("../src/config/effectsConfig.ts")).sakuraConfig;
	defaults.effects = {
		sakura: c.enable,
		sakuraNum: c.sakuraNum,
		limitTimes: c.limitTimes,
		opacityMin: c.opacity?.min,
		opacityMax: c.opacity?.max,
		zIndex: c.zIndex,
	};
}
// ── announcement ──
{
	const c: any = (await import("../src/config/announcementConfig.ts"))
		.announcementConfig;
	defaults.announcement = {
		enabled: c.enable,
		title: c.title,
		content: c.sections?.length ? JSON.stringify(c.sections) : "",
	};
}
// ── footer ──
{
	const c: any = (await import("../src/config/footerConfig.ts")).footerConfig;
	defaults.footer = { enable: c.enable };
}
// ── license ──
{
	const c: any = (await import("../src/config/licenseConfig.ts")).licenseConfig;
	defaults.license = {
		enabled: c.enable,
		name: c.name,
		type: c.type,
		url: c.url,
		icon: c.icon,
	};
}
// ── pio ──
{
	const c: any = (await import("../src/config/pioConfig.ts"))
		.live2dWidgetConfig;
	defaults.pio = {
		enabled: c.enable,
		type: "live2d",
		position: c.position,
		size: c.size,
		opacity: c.opacity,
		zIndex: c.zIndex,
	};
}
// ── analytics ──
{
	const c: any = (await import("../src/config/analyticsConfig.ts"))
		.analyticsConfig;
	defaults.analytics = {
		googleAnalyticsId: c.googleAnalytics?.id,
		microsoftClarityId: c.microsoftClarity?.id,
		umamiUrl: c.umami?.src,
		umamiId: c.umami?.websiteId,
	};
}

writeFileSync(
	"src/config/settings-defaults.json",
	JSON.stringify(defaults, null, 2),
);
console.log(
	"[extract-settings-defaults] saved",
	Object.keys(defaults).length,
	"groups",
);

/**
 * 后台"真实配置"默认值：从 runtime.ts（静态 config 同构输出）展平为后台表单字段。
 * 与 AdminSettings GROUPS 字段一一对应 —— 后台显示 = 静态真实默认 + 已保存覆盖。
 */
import {
	getSiteConfig, getProfileConfig, getCommentConfig, getMusicConfig,
	getWallpaperConfig, getFooterConfig, getEffectsConfig, getPioConfig,
	getLicenseConfig, getSponsorConfig, getDynamicConfig, getAnnouncementConfig,
	getNavbarConfig, getSidebarConfig, getCoverConfig, getFontConfig,
	getExpressiveConfig, getMermaidConfig, getPlantumlConfig, getAnalyticsConfig,
} from "../../src/config/runtime";

type L = Record<string, unknown>;

export function flattenSettingsDefaults(): Record<string, L> {
	const empty = {};
	const sc = getSiteConfig(empty) as L;
	const scAny = sc as unknown as Record<string, any>;
	const pc = getProfileConfig(empty) as L;
	const cc = getCommentConfig(empty) as unknown as Record<string, any>;
	const mc = getMusicConfig(empty) as unknown as Record<string, any>;
	const wc = getWallpaperConfig(empty) as unknown as Record<string, any>;
	const ec = getEffectsConfig(empty) as L;
	const footer = getFooterConfig(empty) as L;
	const pio = getPioConfig(empty) as L;
	const lic = getLicenseConfig(empty) as L;
	const sp = getSponsorConfig(empty) as L;
	const dyn = getDynamicConfig(empty) as unknown as Record<string, any>;
	const ann = getAnnouncementConfig(empty) as L;
	const nav = getNavbarConfig(empty) as unknown as Record<string, any>;
	const sb = getSidebarConfig(empty) as L;
	const cov = getCoverConfig(empty) as L;
	const font = getFontConfig(empty) as L;
	const exp = getExpressiveConfig(empty) as L;
	const mer = getMermaidConfig(empty) as L;
	const plu = getPlantumlConfig(empty) as L;
	const ana = getAnalyticsConfig(empty) as unknown as Record<string, any>;

	const basic: L = {
		title: sc.title, subtitle: sc.subtitle, description: sc.description,
		siteUrl: sc.site_url, siteStartDate: sc.siteStartDate, timezone: sc.timezone,
		pageWidth: sc.pageWidth, categoryBar: sc.categoryBar, categoryStyle: sc.categoryStyle, tagStyle: sc.tagStyle,
		hue: scAny.themeColor?.hue, defaultMode: scAny.themeColor?.defaultMode,
		cardBorder: scAny.card?.border, cardFollowTheme: scAny.card?.followTheme, cardRadius: scAny.card?.radius,
		keywords: Array.isArray(scAny.keywords) ? scAny.keywords.join(",") : "",
		pageFriends: scAny.pages?.friends, pageGuestbook: scAny.pages?.guestbook,
		pageDynamic: scAny.pages?.dynamic, pageGallery: scAny.pages?.gallery,
		pageBooknav: scAny.pages?.booknav, pageBilibili: scAny.pages?.bilibili,
		pageBangumi: scAny.pages?.bangumi, pageVndb: scAny.pages?.vndb,
		pageMal: scAny.pages?.mal, pageSponsor: scAny.pages?.sponsor,
	};
	const profile: L = {
		name: pc.name, avatar: pc.avatar, bio: pc.bio,
		location: pc.location, email: pc.email,
		links: Array.isArray(pc.links) ? JSON.stringify(pc.links) : "",
	};
	const comment: L = {
		type: cc.type,
		giscusRepo: cc.giscus?.repo, giscusRepoId: cc.giscus?.repoId,
		giscusCategory: cc.giscus?.category, giscusCategoryId: cc.giscus?.categoryId,
		twikooEnvId: cc.twikoo?.envId, twikooJsUrl: cc.twikoo?.jsUrl,
		walineServer: cc.waline?.serverURL, disqusShortname: cc.disqus?.shortname,
		artalkServer: cc.artalk?.server, artalkSiteName: cc.artalk?.siteName,
	};
	const music: L = {
		showInNavbar: mc.showInNavbar, showInSidebar: mc.showInSidebar,
		mode: mc.mode, volume: mc.volume, playMode: mc.playMode, showLyrics: mc.showLyrics,
		metingApi: mc.meting?.api, metingServer: mc.meting?.server, metingType: mc.meting?.type,
		metingId: mc.meting?.id, metingAuth: mc.meting?.auth,
		metingFallbackApis: Array.isArray(mc.meting?.fallbackApis) ? JSON.stringify(mc.meting.fallbackApis) : "",
		localPlaylist: Array.isArray(mc.local?.playlist) ? JSON.stringify(mc.local.playlist) : "",
	};
	const theme: L = {
		mode: wc.mode, playerEnable: wc.playerEnable,
		bannerUrl: Array.isArray(wc.src?.desktop) ? (wc.src.desktop as string[]).join(",") : "",
		mobileImages: Array.isArray(wc.src?.mobile) ? (wc.src.mobile as string[]).join(",") : "",
		playerUrl: Array.isArray(wc.src?.playerUrl) ? (wc.src.playerUrl as string[]).join(",") : "",
		dimOpacity: wc.common?.dimOpacity, playerMode: wc.common?.playerMode,
		homeTextEnable: wc.common?.homeText?.enable, homeTitle: wc.common?.homeText?.title,
		homeTitleSize: wc.common?.homeText?.titleSize,
		homeSubtitles: Array.isArray(wc.common?.homeText?.subtitle) ? JSON.stringify(wc.common.homeText.subtitle) : "",
		homeSubtitleSize: wc.common?.homeText?.subtitleSize,
		typewriter: wc.common?.homeText?.typewriter?.enable,
		typewriterSpeed: wc.common?.homeText?.typewriter?.speed,
		typewriterDeleteSpeed: wc.common?.homeText?.typewriter?.deleteSpeed,
		typewriterPauseTime: wc.common?.homeText?.typewriter?.pauseTime,
		carousel: wc.common?.carousel?.enable, carouselInterval: wc.common?.carousel?.interval,
		carouselTransition: wc.common?.carousel?.transitionEffect,
		overlayOpacity: wc.overlay?.opacity, overlayBlur: wc.overlay?.blur,
		overlayCardOpacity: wc.overlay?.cardOpacity,
	};
	const effects: L = { sakura: ec.enable, sakuraNum: ec.sakuraNum, limitTimes: ec.limitTimes, waves: ec.waves, gradient: ec.gradient, bannerCarousel: ec.bannerCarousel };
	const footerL: L = { enable: footer.enable, text: footer.text, icp: footer.icp, startYear: footer.startYear, customHtml: footer.customHtml };
	const pioL: L = { enabled: pio.enable, position: pio.position, size: pio.size, opacity: pio.opacity };
	const license: L = { enabled: lic.enable, name: lic.name, type: lic.type, url: lic.url, icon: lic.icon };
	const sponsor: L = { enabled: sp.enable, qrCode: sp.qrCode };
	const dynamic: L = {
		enabled: true, title: dyn.title, description: dyn.description,
		itemsPerPage: dyn.itemsPerPage, showComment: dyn.showComment, apiUrl: dyn.apiUrl,
		memosEnable: dyn.memos?.enable, memosApiUrl: dyn.memos?.apiUrl,
	};
	const announcement: L = {
		enabled: ann.enable, title: ann.title,
		sections: Array.isArray(ann.sections) ? JSON.stringify(ann.sections) : "",
	};
	const navL: L = { navItems: Array.isArray(nav.links) ? JSON.stringify(nav.links) : "", social: "" };
	const sidebar: L = { hideSidebarOnPostPage: sb.hideSidebarOnPostPage, showBothSidebarsOnPostPage: sb.showBothSidebarsOnPostPage };
	const cover: L = { enable: cov.enable, defaultImage: cov.defaultImage, configurable: cov.configurable };
	const fontL: L = { scale: font.fontScale };
	const expressive: L = { darkTheme: exp.darkTheme, lightTheme: exp.lightTheme };
	const mermaid: L = { lightTheme: mer.lightTheme, darkTheme: mer.darkTheme };
	const plantuml: L = { server: plu.server };
	const analytics: L = {
		googleAnalyticsId: ana.googleAnalyticsId, microsoftClarityId: ana.microsoftClarityId,
		umamiId: ana.umamiAnalytics?.websiteId, umamiUrl: ana.umamiAnalytics?.scriptUrl,
	};

	return {
		basic, profile, comment, music, theme, effects, footer: footerL, pio: pioL,
		license, sponsor, dynamic, announcement, nav: navL, sidebar, cover,
		font: fontL, expressive, mermaid, plantuml, analytics,
	};
}

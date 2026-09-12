import { describe, expect, it } from "vitest";
import { backgroundWallpaper } from "../src/config/backgroundWallpaper";
import { booknavConfig, booknavPageConfig } from "../src/config/booknavConfig";
import { commentConfig } from "../src/config/commentConfig";
import { coverImageConfig } from "../src/config/coverImageConfig";
import { dynamicConfig } from "../src/config/dynamicConfig";
import { sakuraConfig } from "../src/config/effectsConfig";
import { expressiveCodeConfig } from "../src/config/expressiveCodeConfig";
import { fontConfig } from "../src/config/fontConfig";
import { footerConfig } from "../src/config/footerConfig";
import { licenseConfig } from "../src/config/licenseConfig";
import { musicPlayerConfig } from "../src/config/musicConfig";
import { navBarConfig } from "../src/config/navBarConfig";
import { live2dWidgetConfig } from "../src/config/pioConfig";
import { plantumlConfig } from "../src/config/plantumlConfig";
import { profileConfig } from "../src/config/profileConfig";
import { settingsDefaults as d } from "../src/config/settings-defaults";
import { sidebarLayoutConfig } from "../src/config/sidebarConfig";
import { siteConfig } from "../src/config/siteConfig";
import { sponsorConfig } from "../src/config/sponsorConfig";

const bg = backgroundWallpaper;
const home = bg.common.homeText;
const mp = musicPlayerConfig.meting;

// 有意不同（settingsDefaults 取运行时默认值），不参与一致性断言
const EXEMPT = [
	"basic.pageBilibili",
	"basic.pageMal",
	"profile.links",
	"font.codeFont",
	"font.bannerTitleFont",
	"font.bannerSubtitleFont",
	"vndb.mode",
	"myanimelist.username",
	"bilibili.enabled",
	"bilibili.title",
	"sponsor.showComment",
	"sponsor.sponsors",
	"panel",
	"analytics",
	"mermaid",
	"ads",
	"announcement",
];

const CASES: Array<[string, unknown, unknown]> = [
	["basic.title", d.basic.title, siteConfig.title],
	["basic.subtitle", d.basic.subtitle, siteConfig.subtitle],
	["basic.description", d.basic.description, siteConfig.description],
	["basic.siteUrl", d.basic.siteUrl, siteConfig.site_url],
	["basic.siteStartDate", d.basic.siteStartDate, siteConfig.siteStartDate],
	["basic.timezone", d.basic.timezone, siteConfig.timezone],
	["basic.pageWidth", d.basic.pageWidth, siteConfig.pageWidth],
	["basic.categoryBar", d.basic.categoryBar, siteConfig.categoryBar],
	["basic.categoryStyle", d.basic.categoryStyle, siteConfig.categoryStyle],
	["basic.tagStyle", d.basic.tagStyle, siteConfig.tagStyle],
	["basic.hue", d.basic.hue, siteConfig.themeColor.hue],
	["basic.defaultMode", d.basic.defaultMode, siteConfig.themeColor.defaultMode],
	["basic.keywords", d.basic.keywords, siteConfig.keywords.join(",")],
	["basic.pageFriends", d.basic.pageFriends, siteConfig.pages.friends],
	["basic.pageGuestbook", d.basic.pageGuestbook, siteConfig.pages.guestbook],
	["basic.pageDynamic", d.basic.pageDynamic, siteConfig.pages.dynamic],
	["basic.pageGallery", d.basic.pageGallery, siteConfig.pages.gallery],
	["basic.pageBooknav", d.basic.pageBooknav, siteConfig.pages.booknav],
	["basic.pageBangumi", d.basic.pageBangumi, siteConfig.pages.bangumi],
	["basic.pageVndb", d.basic.pageVndb, siteConfig.pages.vndb],
	["basic.pageSponsor", d.basic.pageSponsor, siteConfig.pages.sponsor],

	["profile.name", d.profile.name, profileConfig.name],
	["profile.avatar", d.profile.avatar, profileConfig.avatar],
	["profile.bio", d.profile.bio, profileConfig.bio],

	["theme.mode", d.theme.mode, bg.mode],
	["theme.playerEnable", d.theme.playerEnable, bg.playerEnable],
	["theme.bannerUrl", d.theme.bannerUrl, bg.src.desktop.join(",")],
	["theme.mobileImages", d.theme.mobileImages, bg.src.mobile.join(",")],
	["theme.playerUrl", d.theme.playerUrl, bg.src.playerUrl],
	["theme.dimOpacity", d.theme.dimOpacity, bg.common.dimOpacity],
	["theme.playerMode", d.theme.playerMode, bg.common.playerMode],
	["theme.homeTextEnable", d.theme.homeTextEnable, home.enable],
	["theme.homeTitle", d.theme.homeTitle, home.title],
	["theme.homeTitleSize", d.theme.homeTitleSize, home.titleSize],
	["theme.homeSubtitles", d.theme.homeSubtitles, JSON.stringify(home.subtitle)],
	["theme.homeSubtitleSize", d.theme.homeSubtitleSize, home.subtitleSize],
	["theme.typewriter", d.theme.typewriter, home.typewriter.enable],
	["theme.typewriterSpeed", d.theme.typewriterSpeed, home.typewriter.speed],
	["theme.typewriterDeleteSpeed", d.theme.typewriterDeleteSpeed, home.typewriter.deleteSpeed],
	["theme.typewriterPauseTime", d.theme.typewriterPauseTime, home.typewriter.pauseTime],
	["theme.carousel", d.theme.carousel, bg.common.carousel.enable],
	["theme.carouselInterval", d.theme.carouselInterval, bg.common.carousel.interval],
	["theme.carouselTransition", d.theme.carouselTransition, bg.common.carousel.transitionEffect],
	["theme.overlayOpacity", d.theme.overlayOpacity, bg.overlay.opacity],
	["theme.overlayBlur", d.theme.overlayBlur, bg.overlay.blur],
	["theme.overlayCardOpacity", d.theme.overlayCardOpacity, bg.overlay.cardOpacity],

	["nav.navItems", d.nav.navItems, JSON.stringify(navBarConfig.links)],
	["sidebar.hideSidebarOnPostPage", d.sidebar.hideSidebarOnPostPage, sidebarLayoutConfig.hideSidebarOnPostPage],
	["sidebar.showBothSidebarsOnPostPage", d.sidebar.showBothSidebarsOnPostPage, sidebarLayoutConfig.showBothSidebarsOnPostPage],
	["font.enable", d.font.enable, fontConfig.enable],
	["font.navbarTitleFont", d.font.navbarTitleFont, fontConfig.navbarTitleFont],

	["comment.type", d.comment.type, commentConfig.type],
	["comment.giscusRepo", d.comment.giscusRepo, commentConfig.giscus?.repo],
	["comment.giscusRepoId", d.comment.giscusRepoId, commentConfig.giscus?.repoId],
	["comment.giscusCategory", d.comment.giscusCategory, commentConfig.giscus?.category],
	["comment.giscusCategoryId", d.comment.giscusCategoryId, commentConfig.giscus?.categoryId],
	["comment.twikooEnvId", d.comment.twikooEnvId, commentConfig.twikoo?.envId],
	["comment.twikooJsUrl", d.comment.twikooJsUrl, commentConfig.twikoo?.jsUrl],
	["comment.walineServer", d.comment.walineServer, commentConfig.waline?.serverURL],
	["comment.disqusShortname", d.comment.disqusShortname, commentConfig.disqus?.shortname],
	["comment.artalkServer", d.comment.artalkServer, commentConfig.artalk?.server],

	["cover.showLoading", d.cover.showLoading, coverImageConfig.showLoading],
	["cover.enableInPost", d.cover.enableInPost, coverImageConfig.enableInPost],
	["cover.enableInPostOverlay", d.cover.enableInPostOverlay, coverImageConfig.enableInPostOverlay],
	["cover.randomCoverImage", d.cover.randomCoverImage, JSON.stringify(coverImageConfig.randomCoverImage)],

	["music.showInNavbar", d.music.showInNavbar, musicPlayerConfig.showInNavbar],
	["music.showInSidebar", d.music.showInSidebar, musicPlayerConfig.showInSidebar],
	["music.mode", d.music.mode, musicPlayerConfig.mode],
	["music.volume", d.music.volume, musicPlayerConfig.volume],
	["music.playMode", d.music.playMode, musicPlayerConfig.playMode],
	["music.showLyrics", d.music.showLyrics, musicPlayerConfig.showLyrics],
	["music.metingApi", d.music.metingApi, mp?.api],
	["music.metingServer", d.music.metingServer, mp?.server],
	["music.metingType", d.music.metingType, mp?.type],
	["music.metingId", d.music.metingId, mp?.id],
	["music.metingAuth", d.music.metingAuth, mp?.auth],
	["music.metingFallbackApis", d.music.metingFallbackApis, JSON.stringify(mp?.fallbackApis ?? [])],
	["music.localPlaylist", d.music.localPlaylist, JSON.stringify(musicPlayerConfig.local?.playlist ?? [])],

	["dynamic.enabled", d.dynamic.enabled, siteConfig.pages.dynamic],
	["dynamic.title", d.dynamic.title, dynamicConfig.title],
	["dynamic.description", d.dynamic.description, dynamicConfig.description],
	["dynamic.profileUrl", d.dynamic.profileUrl, dynamicConfig.profileUrl],
	["dynamic.showComment", d.dynamic.showComment, dynamicConfig.showComment],
	["dynamic.itemsPerPage", d.dynamic.itemsPerPage, dynamicConfig.itemsPerPage],
	["dynamic.apiUrl", d.dynamic.apiUrl, dynamicConfig.apiUrl],

	["friends.enabled", d.friends.enabled, siteConfig.pages.friends],
	["gallery.enabled", d.gallery.enabled, siteConfig.pages.gallery],
	["bookmarks.title", d.bookmarks.title, booknavPageConfig.title],
	["bookmarks.description", d.bookmarks.description, booknavPageConfig.description],
	["bookmarks.groups", d.bookmarks.groups, JSON.stringify(booknavConfig)],
	["bookmarks.favicon", d.bookmarks.favicon, JSON.stringify(booknavPageConfig.favicon)],

	["bilibili.uid", d.bilibili.uid, siteConfig.bilibili.uid],
	["vndb.enabled", d.vndb.enabled, siteConfig.pages.vndb],
	["vndb.username", d.vndb.username, siteConfig.vndb.userId],
	["myanimelist.enabled", d.myanimelist.enabled, siteConfig.pages.mal],
	["bangumi.enabled", d.bangumi.enabled, siteConfig.pages.bangumi],
	["bangumi.mode", d.bangumi.mode, siteConfig.bangumi.mode],
	["bangumi.username", d.bangumi.username, siteConfig.bangumi.userId],

	["sponsor.title", d.sponsor.title, sponsorConfig.title],
	["sponsor.description", d.sponsor.description, sponsorConfig.description],
	["sponsor.usage", d.sponsor.usage, sponsorConfig.usage],
	["sponsor.showSponsorsList", d.sponsor.showSponsorsList, sponsorConfig.showSponsorsList],
	["sponsor.showButtonInPost", d.sponsor.showButtonInPost, sponsorConfig.showButtonInPost],

	["effects.sakura", d.effects.sakura, sakuraConfig.enable],
	["effects.sakuraNum", d.effects.sakuraNum, sakuraConfig.sakuraNum],
	["effects.limitTimes", d.effects.limitTimes, sakuraConfig.limitTimes],
	["effects.waves", d.effects.waves, bg.banner.waves.enable.desktop],
	["effects.gradient", d.effects.gradient, bg.banner.gradient.enable.desktop],
	["effects.bannerCarousel", d.effects.bannerCarousel, bg.common.carousel.enable],

	["footer.enable", d.footer.enable, footerConfig.enable],
	["license.enabled", d.license.enabled, licenseConfig.enable],
	["license.name", d.license.name, licenseConfig.name],
	["license.url", d.license.url, licenseConfig.url],
	["license.icon", d.license.icon, licenseConfig.icon],

	["pio.enabled", d.pio.enabled, live2dWidgetConfig.enable],
	["pio.position", d.pio.position, live2dWidgetConfig.position],
	["pio.size", d.pio.size, live2dWidgetConfig.size],

	["plantuml.enable", d.plantuml.enable, plantumlConfig.enable],
	["plantuml.server", d.plantuml.server, plantumlConfig.server],
	["plantuml.lightTheme", d.plantuml.lightTheme, plantumlConfig.lightTheme],
	["plantuml.darkTheme", d.plantuml.darkTheme, plantumlConfig.darkTheme],
	["expressiveCode.darkTheme", d.expressiveCode.darkTheme, expressiveCodeConfig.darkTheme],
	["expressiveCode.lightTheme", d.expressiveCode.lightTheme, expressiveCodeConfig.lightTheme],
];

describe("settingsDefaults 与静态配置一致性", () => {
	it("应一致的字段无漂移", () => {
		const mismatches = CASES.filter(
			([, actual, expected]) =>
				JSON.stringify(actual) !== JSON.stringify(expected),
		).map(
			([label, actual, expected]) =>
				`${label}: settingsDefaults=${JSON.stringify(actual)} static=${JSON.stringify(expected)}`,
		);
		expect(mismatches).toEqual([]);
	});

	it("豁免清单与断言清单不冲突", () => {
		for (const exempt of EXEMPT) {
			const conflict = CASES.some(
				([label]) => label === exempt || label.startsWith(`${exempt}.`),
			);
			expect(conflict, `${exempt} 不应同时出现在断言清单中`).toBe(false);
		}
	});
});


import {
	getSiteConfig, getProfileConfig, getCommentConfig, getMusicConfig,
	getWallpaperConfig, getFooterConfig, getEffectsConfig, getPioConfig,
	getLicenseConfig, getSponsorConfig, getDynamicConfig, getAnnouncementConfig,
	getNavbarConfig, getSidebarConfig, getCoverConfig, getFontConfig,
	getMermaidConfig, getAnalyticsConfig, getPlantumlConfig, getExpressiveCodeConfig,
} from "../../src/config/runtime";
import { settingsDefaults } from "../../src/config/settings-defaults";

type AnyObj = Record<string, any>;
type FlatGroup = Record<string, unknown>;

// 反射取值说明：表单字段名 → 源结构化配置中的取值规则
// - string        : 点路径，按反射逐层取值（支持重命名，如 "site_url" → 表单 siteUrl）
// - { path, join }: 数组按分隔符 join 成字符串（兜底空串）
// - { path, json }: 数组 JSON.stringify（兜底空串）
// - { const }     : 固定常量（源中无对应字段，如 artalkSiteName: ""）
type Spec =
	| string
	| { path: string; join?: string }
	| { path: string; json: true }
	| { const: unknown };

function getByPath(src: AnyObj, path: string): unknown {
	return path.split(".").reduce<unknown>(
		(acc, key) => (acc == null ? acc : (acc as AnyObj)[key]),
		src,
	);
}

function resolve(src: AnyObj, spec: Spec): unknown {
	if (typeof spec === "string") return getByPath(src, spec);
	if ("const" in spec) return spec.const;
	const v = getByPath(src, spec.path);
	if ("json" in spec) return Array.isArray(v) ? JSON.stringify(v) : "";
	if ("join" in spec) return Array.isArray(v) ? v.join(spec.join ?? ",") : "";
	return v;
}

// settings-defaults 中已是扁平表单形状的组，直接展平，无需转换
const PASSTHROUGH = [
	"panel", "friends", "gallery", "bookmarks", "bilibili",
	"vndb", "myanimelist", "bangumi", "ads",
] as const;

// 其余组：声明「源 getter + 字段→取值规则」，由 resolve 反射生成扁平形状
const SCHEMA: Record<string, { src: () => AnyObj; fields: Record<string, Spec> }> = {
	basic: {
		src: () => getSiteConfig({}) as AnyObj,
		fields: {
			title: "title", subtitle: "subtitle", description: "description",
			siteUrl: "site_url", siteStartDate: "siteStartDate", timezone: "timezone",
			pageWidth: "pageWidth", categoryBar: "categoryBar", categoryStyle: "categoryStyle", tagStyle: "tagStyle",
			hue: "themeColor.hue", defaultMode: "themeColor.defaultMode",
			cardBorder: "card.border", cardFollowTheme: "card.followTheme", cardRadius: "card.radius",
			keywords: { path: "keywords", join: "," },
			pageFriends: "pages.friends", pageGuestbook: "pages.guestbook", pageDynamic: "pages.dynamic",
			pageGallery: "pages.gallery", pageBooknav: "pages.booknav", pageBilibili: "pages.bilibili",
			pageBangumi: "pages.bangumi", pageVndb: "pages.vndb", pageMal: "pages.mal", pageSponsor: "pages.sponsor",
		},
	},
	profile: {
		src: () => getProfileConfig({}) as AnyObj,
		fields: {
			name: "name", avatar: "avatar", bio: "bio", location: "location", email: "email",
			links: { path: "links", json: true },
		},
	},
	comment: {
		src: () => getCommentConfig({}) as AnyObj,
		fields: {
			type: "type",
			giscusRepo: "giscus.repo", giscusRepoId: "giscus.repoId",
			giscusCategory: "giscus.category", giscusCategoryId: "giscus.categoryId",
			twikooEnvId: "twikoo.envId", twikooJsUrl: "twikoo.jsUrl",
			walineServer: "waline.serverURL", disqusShortname: "disqus.shortname",
			artalkServer: "artalk.server", artalkSiteName: { const: "" },
		},
	},
	music: {
		src: () => getMusicConfig({}) as AnyObj,
		fields: {
			showInNavbar: "showInNavbar", showInSidebar: "showInSidebar", mode: "mode", volume: "volume",
			playMode: "playMode", showLyrics: "showLyrics",
			metingApi: "meting.api", metingServer: "meting.server", metingType: "meting.type",
			metingId: "meting.id", metingAuth: "meting.auth",
			metingFallbackApis: { path: "meting.fallbackApis", json: true },
			localPlaylist: { path: "local.playlist", json: true },
		},
	},
	theme: {
		src: () => getWallpaperConfig({}) as AnyObj,
		fields: {
			mode: "mode", playerEnable: "playerEnable",
			bannerUrl: { path: "src.desktop", join: "," },
			mobileImages: { path: "src.mobile", join: "," },
			playerUrl: { path: "src.playerUrl", join: "," },
			dimOpacity: "common.dimOpacity", playerMode: "common.playerMode",
			homeTextEnable: "common.homeText.enable", homeTitle: "common.homeText.title", homeTitleSize: "common.homeText.titleSize",
			homeSubtitles: { path: "common.homeText.subtitle", json: true },
			homeSubtitleSize: "common.homeText.subtitleSize",
			typewriter: "common.homeText.typewriter.enable", typewriterSpeed: "common.homeText.typewriter.speed",
			typewriterDeleteSpeed: "common.homeText.typewriter.deleteSpeed", typewriterPauseTime: "common.homeText.typewriter.pauseTime",
			carousel: "common.carousel.enable", carouselInterval: "common.carousel.interval", carouselTransition: "common.carousel.transitionEffect",
			overlayOpacity: "overlay.opacity", overlayBlur: "overlay.blur", overlayCardOpacity: "overlay.cardOpacity",
		},
	},
	effects: {
		src: () => getEffectsConfig({}) as AnyObj,
		fields: {
			sakura: "enable", sakuraNum: "sakuraNum", limitTimes: "limitTimes", waves: "waves",
			gradient: "gradient", bannerCarousel: "bannerCarousel",
		},
	},
	footer: {
		src: () => getFooterConfig({}) as AnyObj,
		fields: { enable: "enable", text: "text", icp: "icp", startYear: "startYear", customHtml: "customHtml" },
	},
	pio: {
		src: () => getPioConfig({}) as AnyObj,
		fields: { enabled: "enable", position: "position", size: "size", opacity: "opacity" },
	},
	license: {
		src: () => getLicenseConfig({}) as AnyObj,
		fields: { enabled: "enable", name: "name", type: "type", url: "url", icon: "icon" },
	},
	sponsor: {
		src: () => getSponsorConfig({}) as AnyObj,
		fields: { enabled: "enable", qrCode: "qrCode", usage: "usage", sponsors: "sponsors" },
	},
	dynamic: {
		src: () => getDynamicConfig({}) as AnyObj,
		fields: {
			enabled: { const: true }, title: "title", description: "description",
			itemsPerPage: "itemsPerPage", showComment: "showComment", apiUrl: "apiUrl",
			memosEnable: "memos.enable", memosApiUrl: "memos.apiUrl",
		},
	},
	announcement: {
		src: () => getAnnouncementConfig({}) as AnyObj,
		fields: { enabled: "enable", title: "title", sections: { path: "sections", json: true } },
	},
	nav: {
		src: () => getNavbarConfig({}) as AnyObj,
		fields: { navItems: { path: "links", json: true }, social: { const: "" } },
	},
	sidebar: {
		src: () => getSidebarConfig({}) as AnyObj,
		fields: { hideSidebarOnPostPage: "hideSidebarOnPostPage", showBothSidebarsOnPostPage: "showBothSidebarsOnPostPage" },
	},
	cover: {
		src: () => getCoverConfig({}) as AnyObj,
		fields: { enable: "enable", defaultImage: "defaultImage", configurable: "configurable" },
	},
	font: {
		src: () => getFontConfig({}) as AnyObj,
		fields: { scale: "fontScale" },
	},
	mermaid: {
		src: () => getMermaidConfig({}) as AnyObj,
		fields: { lightTheme: "lightTheme", darkTheme: "darkTheme" },
	},
	analytics: {
		src: () => getAnalyticsConfig({}) as AnyObj,
		fields: {
			googleAnalyticsId: "googleAnalyticsId", microsoftClarityId: "microsoftClarityId",
			umamiId: "umamiAnalytics.websiteId", umamiUrl: "umamiAnalytics.scriptUrl",
		},
	},
	plantuml: {
		src: () => getPlantumlConfig({}) as AnyObj,
		fields: { enable: "enable", server: "server", lightTheme: "lightTheme", darkTheme: "darkTheme" },
	},
	expressiveCode: {
		src: () => getExpressiveCodeConfig({}) as AnyObj,
		fields: { darkTheme: "darkTheme", lightTheme: "lightTheme" },
	},
};

export function flattenSettingsDefaults(): Record<string, FlatGroup> {
	const out: Record<string, FlatGroup> = {};
	for (const g of PASSTHROUGH) {
		out[g] = { ...(settingsDefaults as AnyObj)[g] };
	}
	for (const [group, spec] of Object.entries(SCHEMA)) {
		const src = spec.src();
		const fields: FlatGroup = {};
		for (const [field, s] of Object.entries(spec.fields)) {
			fields[field] = resolve(src, s);
		}
		out[group] = fields;
	}
	return out;
}

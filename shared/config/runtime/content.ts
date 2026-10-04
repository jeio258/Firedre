// content 域 getter（B4 自 runtime.ts 机械拆分，逻辑零改动）
import type { BooknavFaviconConfig, BooknavGroup } from "@/types/booknavConfig";
import type {
	AnalyticsConfig,
	AnnouncementConfig,
	CommentConfig,
	CoverImageConfig,
	DynamicConfig,
	ExpressiveCodeConfig,
	HitokotoConfig,
	LicenseConfig,
	MermaidConfig,
	MusicPlayerConfig,
	ProfileConfig,
	SponsorConfig,
} from "@/types/config";
import type { FontSelectionConfig } from "@/types/fontConfig";
import type { PlantUMLConfig } from "@/types/plantumlConfig";
import type { SponsorItem } from "@/types/sponsorConfig";
import { settingsDefaults } from "../settings-defaults";
import {
	arr,
	bool,
	DEFAULT_BOOKNAV_FAVICON,
	DEFAULT_BOOKNAV_GROUPS,
	groupOf,
	num,
	settingsOf,
	str,
} from "./helpers";

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
		name: str(pr.name ?? s.name, "Firedre"),
		bio: str(pr.bio ?? s.bio, ""),
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

export function getHitokotoConfig(locals: unknown): HitokotoConfig {
	const h = groupOf(settingsOf(locals), "hitokoto");
	return {
		enable: bool(h.enable, true),
		rotate: bool(h.rotate, true),
		rotateMinutes: Math.max(1, num(h.rotateMinutes, 5)),
		api: str(h.api, "https://v1.hitokoto.cn/?lang=cn"),
		fallbackText: str(h.fallbackText, "世界很大，开心第一。"),
		fallbackSource: str(h.fallbackSource, ""),
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

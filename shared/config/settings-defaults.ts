import { booknavConfig, booknavPageConfig } from "./booknavConfig";

export const settingsDefaults = {
	basic: {
		title: "Firefly",
		subtitle: "Demo site",
		description:
			"Firedre 是基于 Astro Firefly 主题深度云原生化改造的个人博客，全站运行于 Cloudflare Pages / D1 / R2：文章、动态、相册、书签导航、追番数据与留言板一应俱全，后台可视化管理，无需服务器即可稳定运行。",
		siteUrl: "https://firedre.994613.xyz",
		siteStartDate: "2025-01-01",
		timezone: "Asia/Shanghai",
		pageWidth: 100,
		categoryBar: true,
		categoryStyle: "rectangle",
		tagStyle: "pill",
		hue: 165,
		defaultMode: "system",
		pageFriends: true,
		pageGuestbook: true,
		pageDynamic: true,
		pageGallery: true,
		pageBooknav: true,
		pageBilibili: true,
		pageBangumi: false,
		pageVndb: false,
		pageMal: true,
		pageSponsor: true,
		keywords:
			"Firedre,Astro,Firefly,Cloudflare,个人博客,技术博客,云原生,D1,R2,ACGN,动态,相册,书签导航,追番",
	},
	panel: {
		enable: false,
		themeColorSwitchable: false,
		layoutSwitchable: false,
		cardBorderSwitchable: false,
		cardFollowThemeSwitchable: false,
		wallpaperModeSwitchable: false,
		wavesSwitchable: false,
		gradientSwitchable: false,
		bannerTitleSwitchable: false,
		bannerCarouselSwitchable: false,
		sakuraSwitchable: false,
		overlayOpacitySwitchable: false,
		overlayBlurSwitchable: false,
		overlayCardOpacitySwitchable: false,
	},
	profile: {
		name: "Firefly",
		avatar: "assets/images/avatar.avif",
		bio: "Hello, I'm Firefly.",
		links:
			'[{"name":"qq","icon":"fa7-brands:qq","url":"https://qm.qq.com/q/ZGsFa8qX2G","showName":false},{"name":"GitHub","icon":"fa7-brands:github","url":"https://github.com/jeio258","showName":false},{"name":"Email","icon":"fa7-solid:envelope","url":"mailto:xiaye@msn.com","showName":false},{"name":"RSS","icon":"fa7-solid:rss","url":"/rss/","showName":false}]',
	},
	theme: {
		mode: "banner",
		playerEnable: true,
		bannerUrl:
			"assets/images/DesktopWallpaper/d1.avif,assets/images/DesktopWallpaper/d2.avif,assets/images/DesktopWallpaper/d3.avif,assets/images/DesktopWallpaper/d4.avif,assets/images/DesktopWallpaper/d5.avif,assets/images/DesktopWallpaper/d6.avif",
		mobileImages:
			"assets/images/MobileWallpaper/m1.avif,assets/images/MobileWallpaper/m2.avif,assets/images/MobileWallpaper/m3.avif,assets/images/MobileWallpaper/m4.avif,assets/images/MobileWallpaper/m5.avif,assets/images/MobileWallpaper/m6.avif",
		playerUrl: "https://bed.twoleaf.cn/file/1785658612716_firefly.mp4",
		dimOpacity: 0.2,
		playerMode: "random",
		homeTextEnable: true,
		homeTitle: "Lovely firefly!",
		homeTitleSize: "4.5rem",
		homeSubtitles:
			'["In Reddened Chrysalis, I Once Rest","From Shattered Sky, I Free Fall","Amidst Silenced Stars, I Deep Sleep","Upon Lighted Fyrefly, I Soon Gaze","From Undreamt Night, I Thence Shine","In Finalized Morrow, I Full Bloom"]',
		homeSubtitleSize: "1.5rem",
		typewriter: true,
		typewriterSpeed: 100,
		typewriterDeleteSpeed: 50,
		typewriterPauseTime: 2000,
		carousel: false,
		carouselInterval: 5000,
		carouselTransition: "zoom",
		overlayOpacity: 0.8,
		overlayBlur: 10,
		overlayCardOpacity: 0.6,
	},
	nav: {
		navItems:
			'[{"name":"主页","url":"/","icon":"material-symbols:home"},{"name":"文章","url":"#","icon":"material-symbols:article","children":[{"name":"归档","url":"/archive/","icon":"material-symbols:archive"},{"name":"分类","url":"/categories/","icon":"material-symbols:folder-open-rounded"},{"name":"标签","url":"/tags/","icon":"material-symbols:tag-rounded"},{"name":"系列","url":"/series/","icon":"material-symbols:layers"}]},{"name":"社交","url":"#","icon":"material-symbols:group","children":[{"name":"友链","url":"/friends/","icon":"material-symbols:link-2-rounded","pageKey":"friends"},{"name":"留言","url":"/guestbook/","icon":"material-symbols:chat","pageKey":"guestbook"}]},{"name":"我的","url":"#","icon":"material-symbols:person","children":[{"name":"动态","url":"/dynamic/","icon":"material-symbols:forum-rounded","pageKey":"dynamic"},{"name":"相册","url":"/gallery/","icon":"material-symbols:photo-library","pageKey":"gallery"},{"name":"书签导航","url":"/booknav/","icon":"material-symbols:bookmarks","pageKey":"booknav"},{"name":"哔哩哔哩","url":"/bilibili/","icon":"fa7-brands:bilibili","pageKey":"bilibili"},{"name":"番组计划","url":"/bangumi/","icon":"material-symbols:movie","pageKey":"bangumi"},{"name":"VNDB","url":"/vndb/","icon":"material-symbols:chrome-reader-mode-rounded","pageKey":"vndb"},{"name":"AnimeList","url":"/myanimelist/","icon":"material-symbols:menu-book","pageKey":"mal"}]},{"name":"关于","url":"#","icon":"material-symbols:info","children":[{"name":"打赏","url":"/sponsor/","icon":"material-symbols:favorite","pageKey":"sponsor"},{"name":"关于我","url":"/about/","icon":"material-symbols:person"}]},{"name":"链接","url":"#","icon":"material-symbols:link","children":[]}]',
		navbarMode: "fixed",
	},
	post: {
		// 文章底部区块开关（后台可切换）
		share: true,
		postNavigation: true,
		relatedPosts: true,
		randomPosts: true,
	},
	sidebar: {
		hideSidebarOnPostPage: false,
		noSidebarContentWidth: 0.6,
	},
	font: {
		enable: true,
		codeFont: "",
		bannerTitleFont: "",
		bannerSubtitleFont: "",
		navbarTitleFont: "",
	},
	comment: {
		type: "none",
		giscusRepo: "jeio258/Firedre",
		giscusRepoId: "R_kgD2gfdFGd",
		giscusCategory: "General",
		giscusCategoryId: "DIC_kwDOKy9HOc4CegmW",
		twikooEnvId: "https://twikoo.vercel.app",
		twikooJsUrl:
			"https://cdn.jsdelivr.net/npm/twikoo@1.7.14/dist/twikoo.min.js",
		walineServer: "https://waline.vercel.app",
		disqusShortname: "firefly",
		artalkServer: "https://artalk.example.com/",
	},
	cover: {
		showLoading: false,
		enableInPost: true,
		enableInPostOverlay: false,
		randomCoverImage: JSON.stringify({
			enable: false,
			apis: [
				"https://t.alcy.cc/pc",
				"https://www.dmoe.cc/random.php",
				"https://uapis.cn/api/v1/random/image?category=acg&type=pc",
			],
		}),
	},
	music: {
		showInNavbar: true,
		showInSidebar: true,
		mode: "local",
		volume: 0.7,
		playMode: "list",
		showLyrics: false,
		metingApi:
			"https://api.i-meto.com/meting/api?server=:server&type=:type&id=:id&r=:r",
		metingServer: "netease",
		metingType: "playlist",
		metingId: "10046455237",
		metingAuth: "",
		metingFallbackApis:
			'["https://api.injahow.cn/meting/?server=:server&type=:type&id=:id","https://api.moeyao.cn/meting/?server=:server&type=:type&id=:id"]',
		sourceScript: "kh-v1.7.16",
		localPlaylist:
			'[{"name":"使一颗心免于哀伤","artist":"知更鸟 / HOYO-MiX / Chevy","url":"/assets/music/使一颗心免于哀伤-哼唱.mp3","cover":"/assets/music/cover/109951169585655912.webp","lrc":""},{"name":"晴天","artist":"周杰伦","source":"tx","id":"0039MnYb0qxYhV","quality":"128k","cover":"/assets/music/cover/109951169585655912.webp","lrc":""}]',
	},
	mermaid: {
		enabled: true,
	},
	dynamic: {
		enabled: true,
		title: "",
		description: "",
		profileUrl: "/about/",
		showComment: true,
		itemsPerPage: 20,
		apiUrl: "/api/dynamic.json",
	},
	friends: {
		enabled: true,
	},
	gallery: {
		enabled: true,
	},
	bookmarks: {
		title: "",
		description: "",
		groups: JSON.stringify(booknavConfig),
		favicon: JSON.stringify(booknavPageConfig.favicon),
	},
	bilibili: {
		enabled: true,
		uid: "38932988",
		title: "哔哩哔哩",
	},
	vndb: {
		enabled: false,
		mode: "dynamic",
		username: "u358128",
	},
	myanimelist: {
		enabled: false,
		username: "",
	},
	bangumi: {
		enabled: false,
		mode: "dynamic",
		username: "1143164",
	},
	ads: {
		enabled: false,
		adSenseId: "",
		customCode: "",
	},
	sponsor: {
		title: "",
		description: "",
		usage:
			"您的打赏将用于服务器维护、内容创作和功能开发，帮助我持续提供优质内容。",
		showButtonInPost: true,
		showSponsorsList: true,
		sponsors: [
			{
				name: "夏叶",
				avatar:
					"https://weavatar.com/avatar/d252655d40d6874417a720bad0a6c5f77f8f338402dc37e4190?s=640",
				amount: "¥50",
				date: "2025-10-01",
			},
			{ name: "匿名用户", amount: "¥20", date: "2025-10-01" },
		],
	},
	effects: {
		sakura: false,
		sakuraNum: 21,
		limitTimes: -1,
		waves: true,
		gradient: true,
		bannerCarousel: false,
	},
	announcement: {
		title: "",
		content: "",
	},
	footer: {
		enable: false,
	},
	license: {
		enabled: true,
		name: "CC BY-NC-SA 4.0",
		url: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
		icon: "",
	},
	analytics: {},
	plantuml: {
		enable: true,
		server: "https://www.plantuml.com/plantuml",
		lightTheme: "",
		darkTheme: "cyborg",
	},
	expressiveCode: {
		darkTheme: "one-dark-pro",
		lightTheme: "one-light",
	},
} as const;

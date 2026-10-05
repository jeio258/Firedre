// settingsDefaults 的 appearance 域分组（自 settings-defaults.ts 机械拆分，内容零改动）
export const appearanceDefaults = {
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
		// ── 结构字段（A4：自 backgroundWallpaper 原值整体内嵌，getter 透传源） ──
		wallpaperBase: {
			mode: "banner",
			playerEnable: true,
			src: {
				desktop: [
					"assets/images/DesktopWallpaper/d1.avif",
					"assets/images/DesktopWallpaper/d2.avif",
					"assets/images/DesktopWallpaper/d3.avif",
					"assets/images/DesktopWallpaper/d4.avif",
					"assets/images/DesktopWallpaper/d5.avif",
					"assets/images/DesktopWallpaper/d6.avif",
				],
				mobile: [
					"assets/images/MobileWallpaper/m1.avif",
					"assets/images/MobileWallpaper/m2.avif",
					"assets/images/MobileWallpaper/m3.avif",
					"assets/images/MobileWallpaper/m4.avif",
					"assets/images/MobileWallpaper/m5.avif",
					"assets/images/MobileWallpaper/m6.avif",
				],
				playerUrl: "https://bed.twoleaf.cn/file/1785658612716_firefly.mp4",
			},
			common: {
				dimOpacity: 0.2,
				playerMode: "random",
				homeText: {
					enable: true,
					title: "Lovely firefly!",
					titleSize: "4.5rem",
					subtitle: [
						"In Reddened Chrysalis, I Once Rest",
						"From Shattered Sky, I Free Fall",
						"Amidst Silenced Stars, I Deep Sleep",
						"Upon Lighted Fyrefly, I Soon Gaze",
						"From Undreamt Night, I Thence Shine",
						"In Finalized Morrow, I Full Bloom",
					],
					subtitleSize: "1.5rem",
					typewriter: {
						enable: true,
						speed: 100,
						deleteSpeed: 50,
						pauseTime: 2000,
					},
					linksEnable: true,
					links: [
						{
							name: "GitHub",
							icon: "fa7-brands:github",
							url: "https://github.com/jeio258/Firedre",
							showName: true,
						},
						{
							name: "Email",
							icon: "fa7-solid:envelope",
							url: "mailto:xiaye@msn.com",
						},
						{
							name: "Sponsor",
							icon: "material-symbols:favorite",
							url: "https://blog.cuteleaf.cn/sponsor/",
						},
						{ name: "RSS", icon: "fa7-solid:rss", url: "/rss/" },
					],
				},
				carousel: { enable: false, interval: 5000, transitionEffect: "zoom" },
			},
			banner: {
				position: "0% 20%",
				postInfo: { mode: "description" },
				navbar: { transparentMode: "semi", blur: 12 },
				waves: { enable: { desktop: true, mobile: true } },
				gradient: { enable: { desktop: true, mobile: true }, height: "10%" },
			},
			overlay: { zIndex: 0, opacity: 0.8, blur: 10, cardOpacity: 0.6 },
			fullscreen: {
				position: "center",
				navbar: { dynamicTransparent: false },
				blurRamp: { enable: { desktop: true, mobile: true } },
			},
		},
	},
	nav: {
		social: "",
		navItems:
			'[{"name":"主页","url":"/","icon":"material-symbols:home"},{"name":"文章","url":"#","icon":"material-symbols:article","children":[{"name":"归档","url":"/archive/","icon":"material-symbols:archive"},{"name":"分类","url":"/categories/","icon":"material-symbols:folder-open-rounded"},{"name":"标签","url":"/tags/","icon":"material-symbols:tag-rounded"},{"name":"系列","url":"/series/","icon":"material-symbols:layers"}]},{"name":"社交","url":"#","icon":"material-symbols:group","children":[{"name":"友链","url":"/friends/","icon":"material-symbols:link-2-rounded","pageKey":"friends"},{"name":"留言","url":"/guestbook/","icon":"material-symbols:chat","pageKey":"guestbook"}]},{"name":"我的","url":"#","icon":"material-symbols:person","children":[{"name":"动态","url":"/dynamic/","icon":"material-symbols:forum-rounded","pageKey":"dynamic"},{"name":"相册","url":"/gallery/","icon":"material-symbols:photo-library","pageKey":"gallery"},{"name":"书签导航","url":"/booknav/","icon":"material-symbols:bookmarks","pageKey":"booknav"},{"name":"哔哩哔哩","url":"/bilibili/","icon":"fa7-brands:bilibili","pageKey":"bilibili"},{"name":"番组计划","url":"/bangumi/","icon":"material-symbols:movie","pageKey":"bangumi"},{"name":"VNDB","url":"/vndb/","icon":"material-symbols:chrome-reader-mode-rounded","pageKey":"vndb"},{"name":"AnimeList","url":"/myanimelist/","icon":"material-symbols:menu-book","pageKey":"mal"}]},{"name":"关于","url":"#","icon":"material-symbols:info","children":[{"name":"打赏","url":"/sponsor/","icon":"material-symbols:favorite","pageKey":"sponsor"},{"name":"关于我","url":"/about/","icon":"material-symbols:person"}]},{"name":"链接","url":"#","icon":"material-symbols:link","children":[]}]',
		navbarMode: "fixed",
	},
	sidebar: {
		showProfile: true,
		showAnnouncement: true,
		showMusic: true,
		showCategories: true,
		showTags: true,
		showCalendar: true,
		hideSidebarOnPostPage: false,
		noSidebarContentWidth: 0.6,
		// ── 结构字段（A4：自 sidebarLayoutConfig 原值搬移） ──
		enable: true,
		position: "both",
		tabletSidebar: "left",
		leftComponents: [
			{
				type: "profile",
				enable: true,
				position: "top",
				showOnPostPage: true,
			},
			{
				type: "announcement",
				enable: true,
				position: "top",
				showOnPostPage: true,
			},
			{
				type: "music",
				enable: true,
				position: "top",
				showOnPostPage: true,
			},
			{
				type: "categories",
				enable: true,
				position: "sticky",
				showOnPostPage: true,
				specificConfig: {
					collapseThreshold: 5,
				},
			},
			{
				type: "tags",
				enable: true,
				position: "sticky",
				showOnPostPage: true,
				specificConfig: {
					collapseThreshold: 10,
				},
			},
		],
		rightComponents: [
			{
				type: "dynamic",
				enable: true,
				position: "top",
				showOnPostPage: true,
				specificConfig: {
					dynamic: {
						limit: 2,
					},
				},
			},
			{
				type: "stats",
				enable: true,
				position: "top",
				showOnPostPage: false,
			},
			{
				type: "siteInfo",
				enable: true,
				position: "top",
				showOnPostPage: false,
				specificConfig: {
					siteInfo: {
						unknownBuildPlatform: "Unknown CI",
					},
				},
			},
			{
				type: "calendar",
				enable: true,
				showTitle: false,
				position: "sticky",
				showOnPostPage: false,
				specificConfig: {
					calendar: {
						showHeatmap: true,
					},
				},
			},
			{
				type: "sidebarToc",
				enable: true,
				position: "sticky",
				showOnPostPage: true,
				hideOnNonPostPage: true,
			},
			{
				type: "advertisement",
				enable: false,
				showTitle: false,
				position: "sticky",
				showOnPostPage: true,
				specificConfig: {
					ad: {
						image: {
							src: "/assets/images/ad/ad1.webp",
							alt: "广告横幅",
							link: "https://haoka.lot-ml.com/plugreg.html?agentid=1423316",
							external: true,
						},
						closable: false,
						displayCount: -1,
						padding: {
							all: "1rem",
						},
					},
				},
			},
			{
				type: "advertisement",
				enable: false,
				position: "sticky",
				showOnPostPage: true,
				specificConfig: {
					ad: {
						title: "支持博主",
						content:
							"如果您觉得本站内容对您有帮助，欢迎支持我们的创作！您的支持是我们持续更新的动力。",
						link: {
							text: "支持一下",
							url: "about/",
							external: false,
						},
						closable: false,
						displayCount: -1,
					},
				},
			},
			{
				type: "hitokoto",
				enable: true,
				position: "top",
				showOnPostPage: true,
			},
		],
		mobileBottomComponents: [
			{
				type: "announcement",
				enable: true,
				showOnPostPage: true,
			},
			{
				type: "categories",
				enable: true,
				showOnPostPage: true,
				specificConfig: {
					collapseThreshold: 5,
				},
			},
			{
				type: "tags",
				enable: true,
				showOnPostPage: true,
				specificConfig: {
					collapseThreshold: 10,
				},
			},
			{
				type: "dynamic",
				enable: true,
				showOnPostPage: true,
				specificConfig: {
					dynamic: {
						limit: 2,
					},
				},
			},
			{
				type: "stats",
				enable: true,
				showOnPostPage: true,
			},
			{
				type: "siteInfo",
				enable: true,
				showOnPostPage: true,
				specificConfig: {
					siteInfo: {
						unknownBuildPlatform: "Unknown CI",
					},
				},
			},
			{
				type: "hitokoto",
				enable: true,
				showOnPostPage: true,
			},
		],
	},
	font: {
		scale: 1,
		enable: true,
		codeFont: "--font-jetbrains-mono",
		bannerTitleFont: "--font-zen-maru-gothic",
		bannerSubtitleFont: "--font-inter",
		navbarTitleFont: "",
	},
	cover: {
		enable: false,
		defaultImage: "",
		configurable: false,
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
	effects: {
		sakura: false,
		sakuraNum: 21,
		limitTimes: -1,
		waves: true,
		gradient: true,
		bannerCarousel: false,
	},
	expressiveCode: {
		darkTheme: "one-dark-pro",
		lightTheme: "one-light",
	},
} as const;

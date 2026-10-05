// settingsDefaults 的 features 域分组（自 settings-defaults.ts 机械拆分，内容零改动）
export const featuresDefaults = {
	post: {
		// 文章底部区块开关（后台可切换）
		share: true,
		postNavigation: true,
		relatedPosts: true,
		randomPosts: true,
		// ── 结构字段（A4：自 siteConfig.post 原值搬移） ──
		showLastModified: true,
		outdatedThreshold: 30,
		generateOgImages: false,
		rehypeCallouts: {
			theme: "github",
			enablePythonMarkdownAdmonitions: false,
		},
	},
	comment: {
		enabled: true,
		artalkSiteName: "",
		type: "none",
		giscusRepo: "",
		giscusRepoId: "",
		giscusCategory: "",
		giscusCategoryId: "",
		twikooEnvId: "",
		twikooJsUrl:
			"https://cdn.jsdelivr.net/npm/twikoo@1.7.14/dist/twikoo.min.js",
		walineServer: "",
		disqusShortname: "",
		artalkServer: "",
	},
	music: {
		enabled: true,
		autoplay: false,
		showInNavbar: true,
		showInSidebar: true,
		mode: "local",
		volume: 0.7,
		playMode: "list",
		showLyrics: false,
		metingApi: "",
		metingServer: "netease",
		metingType: "playlist",
		metingId: "",
		metingAuth: "",
		metingFallbackApis:
			'["https://api.injahow.cn/meting/?server=:server&type=:type&id=:id","https://api.moeyao.cn/meting/?server=:server&type=:type&id=:id"]',
		sourceScript: "kh-v1.7.16",
		localPlaylist:
			'[{"name":"使一颗心免于哀伤","artist":"知更鸟 / HOYO-MiX / Chevy","url":"/assets/music/使一颗心免于哀伤-哼唱.mp3","cover":"/assets/music/cover/109951169585655912.webp","lrc":""},{"name":"晴天","artist":"周杰伦","source":"tx","id":"0039MnYb0qxYhV","quality":"128k","cover":"/assets/music/cover/109951169585655912.webp","lrc":""}]',
	},
	hitokoto: {
		enable: true,
		rotate: true,
		rotateMinutes: 5,
		api: "https://v1.hitokoto.cn/?lang=cn",
		fallbackText: "世界很大，开心第一。",
		fallbackSource: "",
	},
	mermaid: {
		lightTheme: "editor-light",
		darkTheme: "editor-dark",
		enabled: true,
	},
	plantuml: {
		enable: true,
		server: "https://www.plantuml.com/plantuml",
		lightTheme: "",
		darkTheme: "cyborg",
	},
	dynamic: {
		memosEnable: false,
		memosApiUrl: "https://memos.example.com",
		enabled: true,
		title: "",
		description: "",
		profileUrl: "/about/",
		showComment: true,
		itemsPerPage: 20,
		apiUrl: "/api/dynamic.json",
	},
	analytics: {
		googleAnalyticsId: "",
		microsoftClarityId: "",
		umamiId: "",
		umamiUrl: "https://cloud.umami.is/script.js",
	},
} as const;

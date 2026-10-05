// settingsDefaults 的 pages 域分组（自 settings-defaults.ts 机械拆分，内容零改动）
export const pagesDefaults = {
	friends: {
		enabled: true,
	},
	gallery: {
		enabled: true,
	},
	bookmarks: {
		title: "",
		description: "",
		groups:
			'[{"id":"dev","name":"开发","icon":"material-symbols:code-rounded","desc":"写代码时离不开的站点","weight":100,"items":[{"title":"GitHub","url":"https://github.com","desc":"全球最大的代码托管平台","icon":"fa7-brands:github","weight":10},{"title":"MDN Web Docs","url":"https://developer.mozilla.org","desc":"最权威的 Web 技术文档","weight":9},{"title":"Astro","url":"https://astro.build","desc":"内容驱动型网站的 Web 框架","weight":8},{"title":"Svelte","url":"https://svelte.dev","desc":"把组件编译成高效原生 JS 的框架","weight":7},{"title":"Tailwind CSS","url":"https://tailwindcss.com","desc":"一个功能强大且灵活的 CSS 框架","weight":6}]},{"id":"opensource","name":"项目","icon":"material-symbols:code-rounded","desc":"好用的开源项目","weight":90,"items":[{"title":"Firedre","url":"https://github.com/jeio258/Firedre","desc":"清晰美观的 Astro 个人博客主题模板","icon":"/favicon/firefly-32.png","weight":10}]},{"id":"design","name":"设计","icon":"material-symbols:palette-outline","desc":"配色、图标与灵感来源","weight":90,"items":[{"title":"Iconify","url":"https://icon-sets.iconify.design","desc":"海量开源图标集合搜索","weight":10},{"title":"iconfont","url":"https://www.iconfont.cn","desc":"阿里巴巴矢量图标库","weight":9}]},{"id":"tools","name":"工具","icon":"material-symbols:build-outline-rounded","desc":"顺手的在线小工具","weight":80,"items":[{"title":"TinyPNG","url":"https://tinypng.com","desc":"在线压缩 PNG / JPEG 图片","weight":10},{"title":"Squoosh","url":"https://squoosh.app","desc":"Google 出品的图片压缩与格式转换","weight":9},{"title":"Carbon","url":"https://carbon.now.sh","desc":"把代码片段生成漂亮的图片","weight":8}]},{"id":"resources","name":"资源","icon":"material-symbols:auto-stories-outline-rounded","desc":"文档、教程与阅读","weight":70,"items":[]}]',
		favicon: '{"enabled":true,"api":"https://a.favicon.im/{domain}"}',
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
	sponsor: {
		enabled: false,
		qrCode: "",
		title: "",
		description: "",
		usage:
			"您的打赏将用于服务器维护、内容创作和功能开发，帮助我持续提供优质内容。",
		showButtonInPost: true,
		showSponsorsList: true,
		sponsors: [],
	},
} as const;

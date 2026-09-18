import type { SiteConfig } from "@/types/siteConfig";
import { resolvePageToggles } from "../utils/page-toggle-utils";
import { resolveSiteLang } from "../utils/site-config-utils";

const SITE_LANG = resolveSiteLang("zh_CN");

const pages = resolvePageToggles({
	friends: true,
	guestbook: true,
	dynamic: true,
	gallery: true,
	booknav: true,
	bilibili: false,
	bangumi: false,
	vndb: false,
	mal: false,
	sponsor: true,
});

export const siteConfig: SiteConfig = {
	title: "Firefly",

	subtitle: "Demo site",

	site_url: "https://firedre.994613.xyz",

	description:
		"Firefly 是一款基于 Astro 框架和 Fuwari 模板开发的清新美观且现代化个人博客主题模板，专为技术爱好者和内容创作者设计。该主题融合了现代 Web 技术栈，提供了丰富的功能模块和高度可定制的界面，让您能够轻松打造出专业且美观的个人博客网站。",

	keywords: [
		"Firefly",
		"Fuwari",
		"Astro",
		"ACGN",
		"博客",
		"技术博客",
		"静态博客",
	],

	themeColor: {
		hue: 165,
		// 取值："light" 亮色，"dark" 暗色，"system" 跟随系统
		defaultMode: "system",
	},

	pageWidth: 100,

	card: {
		border: false,
		followTheme: false,
		// 卡片圆角大小 (rem)，作用于前台所有卡片
		radius: 1,
	},

	favicon: [
		{
			src: "/favicon/firefly-32.png",
		},
	],

	navbar: {
		logo: {
			type: "image",
			value: "assets/images/logo/firefly-light.png",
			valueDark: "assets/images/logo/firefly-dark.png",
			alt: "🍀",
		},
		title: "Firefly",
		widthFull: false,
		// 菜单对齐方式：left 左对齐，center 居中
		menuAlign: "center",
		followTheme: false,
		stickyNavbar: true,
	},

	// 用于统计站点运行天数
	siteStartDate: "2025-01-01",

	timezone: "Asia/Shanghai",

	// 首页与归档页顶部显示分类快捷导航
	categoryBar: true,

	categoryStyle: "rectangle",

	tagStyle: "pill",

	// 归档页折叠非最新年份文章，禁用则默认展开全部
	foldArticle: true,

	postListLayout: {
		defaultMode: "list",
		// 不设置则跟随 defaultMode
		mobileDefaultMode: "grid",

		coverPosition: "right",
		// 设为 0 则不截断简介
		descriptionLines: 2,
		showStatsIcons: true,

		tagsPosition: "bottom",

		tagsBottomStyle: "chip",
		meta: {
			showPublished: true,
			showCategory: true,
			showTags: true,
			// 设为 0 则不限制标签数量
			tagCount: 3,
			showWords: false,
			showReadingTime: false,
		},

		stats: {
			showPublished: true,
			showWords: true,
			showReadingTime: true,
		},

		grid: {
			// 混合有/无封面图文章时推荐开启
			masonry: false,
			// 网格卡片最小宽度(px)，浏览器依容器宽度自动计算列数
			columnWidth: 320,

			coverFullWidth: false,
		},
	},

	pagination: {
		postsPerPage: 10,
	},

	post: {
		rehypeCallouts: {
			theme: "github",

			enablePythonMarkdownAdmonitions: false,
		},
		showLastModified: true,
		// 超过该天数(天)才显示"上次编辑"卡片
		outdatedThreshold: 30,
		sharePoster: true,

		generateOgImages: false,
	},

	bilibili: {
		uid: "38932988",
	},

	bangumi: {
		userId: "1143164",

		mode: "dynamic",
		apiUrl: "https://api.bangumi.pro",
		subjectBaseUrl: "https://api.bangumi.pro/subject/",

		categoryOrder: ["anime", "book", "music", "game"],

		nsfw: "hide",
	},

	vndb: {
		userId: "u358128",

		mode: "static",

		downloadCovers: false,
		apiUrl: "https://api.vndb.org/kana",
		// 末尾需带 /
		vnBaseUrl: "https://vndb.org/",
		// 仅 static 模式使用；不要把真实令牌提交到公开仓库！
		apiToken: "",

		nsfw: "hide",
	},

	mal: {
		// 列表需为公开状态，私密列表无法读取
		username: "cuteleaf",

		clientId: "0ef34371450f9c6c809deaadec6aa8f3",
		apiUrl: "https://api.myanimelist.net/v2",
		// 末尾需带 /
		animeBaseUrl: "https://myanimelist.net/anime/",
		// 末尾需带 /
		mangaBaseUrl: "https://myanimelist.net/manga/",

		nsfw: "hide",
	},

	imageOptimization: {
		formats: "webp",
		// 压缩质量 (1-100)，推荐 70-85
		quality: 85,

		noReferrerDomains: [
			"*.hdslb.com",
			"*.bilibili.com",
			"*.myanimelist.net",
			"*.vndb.org",
		],
	},

	// 由文件顶部 SITE_LANG 解析得到
	lang: SITE_LANG,

	// 由文件顶部 pages 解析得到
	pages,
};

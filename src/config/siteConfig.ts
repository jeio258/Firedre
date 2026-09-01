import type { SiteConfig } from "@/types/siteConfig";
import { resolvePageToggles } from "../utils/page-toggle-utils";
import { resolveSiteLang } from "../utils/site-config-utils";

const SITE_LANG = resolveSiteLang("zh_CN");

const pages = resolvePageToggles({

	// 友链页面开关
	friends: true,
	// 留言板页面开关，需要配置评论系统
	guestbook: true,

	// 动态页面开关
	dynamic: true,
	// 相册页面开关
	gallery: true,
	// 书签导航页面开关
	booknav: true,
	// 哔哩哔哩追番页面开关
	bilibili: false,
	// 番组计划页面开关
	bangumi: false,
	// VNDB页面开关
	vndb: false,
	// MyAnimeList页面开关
	mal: false,

	// 打赏页面开关
	sponsor: true,
});

export const siteConfig: SiteConfig = {
	// 站点标题
	title: "Firefly",

	// 站点副标题
	subtitle: "Demo site",

	// 站点 URL
	site_url: "https://firedre.994613.xyz",

	// 站点描述
	description:
		"Firefly 是一款基于 Astro 框架和 Fuwari 模板开发的清新美观且现代化个人博客主题模板，专为技术爱好者和内容创作者设计。该主题融合了现代 Web 技术栈，提供了丰富的功能模块和高度可定制的界面，让您能够轻松打造出专业且美观的个人博客网站。",

	// 站点关键词
	keywords: [
		"Firefly",
		"Fuwari",
		"Astro",
		"ACGN",
		"博客",
		"技术博客",
		"静态博客",
	],

	// 主题色
	themeColor: {

		hue: 165,
		// 默认模式："light" 亮色，"dark" 暗色，"system" 跟随系统
		defaultMode: "system",
	},

	pageWidth: 100,

	// 网站Card样式配置
	card: {
		// 是否开启卡片边框和阴影，开启后让网站更有立体感
		border: false,
		// 是否让卡片风格跟随主题色相
		followTheme: false,
		// 卡片圆角大小 (rem)，前台所有卡片的圆角半径
		radius: 1,
	},

	favicon: [
		{
			// 图标文件路径
			src: "/favicon/firefly-32.png",

		},
	],

	// 导航栏配置
	navbar: {

		logo: {
			type: "image",
			value: "assets/images/logo/firefly-light.png",
			valueDark: "assets/images/logo/firefly-dark.png",
			alt: "🍀",
		},
		// 导航栏标题
		title: "Firefly",
		// 全宽导航栏，导航栏是否占满屏幕宽度
		widthFull: false,
		// 导航菜单对齐方式，left：左对齐，center：居中
		menuAlign: "center",
		// 导航栏图标和标题是否跟随主题色
		followTheme: false,
		// 导航栏是否固定在顶部并始终可见
		stickyNavbar: true,
	},

	// 站点开始日期，用于统计运行天数
	siteStartDate: "2025-01-01",

	timezone: "Asia/Shanghai",

	// 分类导航栏开关，在首页和归档页顶部显示分类快捷导航
	categoryBar: true,

	categoryStyle: "rectangle",

	tagStyle: "pill",

	// 归档页是否折叠非最新年份文章，禁用后默认展开全部年份
	foldArticle: true,

	postListLayout: {

		defaultMode: "list",
		// 移动端默认布局模式，不设置则跟随 defaultMode
		mobileDefaultMode: "grid",

		coverPosition: "right",
		// 文章简介显示行数，设为 0 则不截断
		descriptionLines: 2,
		// 文章卡片底部统计和发布日期是否显示图标
		showStatsIcons: true,

		tagsPosition: "bottom",

		tagsBottomStyle: "chip",
		// PostMeta 元数据显示控制
		meta: {
			// 是否显示发布日期
			showPublished: true,
			// 是否显示分类
			showCategory: true,
			// 是否显示标签
			showTags: true,
			// 标签数量，设为 0 则不限制
			tagCount: 3,
			// 是否显示字数
			showWords: false,
			// 是否显示阅读时间
			showReadingTime: false,
		},

		stats: {
			// 是否显示发布日期
			showPublished: true,
			// 是否显示字数
			showWords: true,
			// 是否显示阅读时间
			showReadingTime: true,
		},

		grid: {
			// 是否开启瀑布流布局，同时有封面图和无封面图的混合文章推荐开启
			masonry: false,
			// 网格模式卡片最小宽度(px)，浏览器根据容器宽度自动计算列数
			columnWidth: 320,

			coverFullWidth: false,
		},
	},

	// 分页配置
	pagination: {
		// 每页显示的文章数量
		postsPerPage: 10,
	},

	post: {

		rehypeCallouts: {
			theme: "github",

			enablePythonMarkdownAdmonitions: false,
		},
		// 文章页底部的"上次编辑时间"卡片开关
		showLastModified: true,
		// 文章过期阈值（天数），超过此天数才显示"上次编辑"卡片
		outdatedThreshold: 30,
		// 是否开启分享海报生成功能
		sharePoster: true,

		generateOgImages: false,
	},

	bilibili: {
		// 你的 Bilibili 用户 UID
		uid: "38932988",
	},

	bangumi: {
		// Bangumi用户ID
		userId: "1143164",

		mode: "dynamic",
		// Bangumi API 地址
		apiUrl: "https://api.bangumi.pro",
		// 详情页地址
		subjectBaseUrl: "https://api.bangumi.pro/subject/",

		categoryOrder: ["anime", "book", "music", "game"],

		nsfw: "hide",
	},

	vndb: {
		// VNDB 用户 ID
		userId: "u358128",

		mode: "static",

		downloadCovers: false,
		// VNDB API 地址
		apiUrl: "https://api.vndb.org/kana",
		// 条目详情页地址，末尾需要带 /
		vnBaseUrl: "https://vndb.org/",
		// 私密列表访问令牌，仅 static 模式下使用；不要把真实令牌提交到公开仓库！
		apiToken: "",

		nsfw: "hide",
	},

	mal: {
		// MyAnimeList 用户名（列表需为公开状态，私密列表无法读取）
		username: "cuteleaf",

		clientId: "0ef34371450f9c6c809deaadec6aa8f3",
		// MAL API 地址
		apiUrl: "https://api.myanimelist.net/v2",
		// 动画条目详情页地址，末尾需要带 /
		animeBaseUrl: "https://myanimelist.net/anime/",
		// 漫画条目详情页地址，末尾需要带 /
		mangaBaseUrl: "https://myanimelist.net/manga/",

		nsfw: "hide",
	},

	imageOptimization: {

		formats: "webp",
		// 图片压缩质量 (1-100)，值越低体积越小但质量越差，推荐 70-85
		quality: 85,

		noReferrerDomains: [
			"*.hdslb.com",
			"*.bilibili.com",
			"*.myanimelist.net",
			"*.vndb.org",
		],
	},

	// 站点语言，在本配置文件顶部SITE_LANG定义
	lang: SITE_LANG,

	// 页面开关配置，在本配置文件顶部pages定义
	pages,
};

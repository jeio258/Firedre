import { fontsList } from "@shared/config/fontConfig";

export type FieldType =
	| "text"
	| "number"
	| "boolean"
	| "textarea"
	| "json"
	| "password"
	| "select"
	| "records";
export interface SelectOption {
	label: string;
	value: string;
}
/** type="records" 时单条记录的字段声明（key 为空字符串表示纯字符串列表） */
export interface RecordFieldSpec {
	key: string;
	label: string;
	required?: boolean;
	/** 允许值；填写后按枚举校验 */
	options?: string[];
	/** 行内文本与存储值的类型转换，默认 string；list 表示逗号分隔的字符串数组 */
	valueType?: "string" | "boolean" | "number" | "list";
}
export interface Field {
	name: string;
	label: string;
	type: FieldType;
	placeholder?: string;
	hint?: string;
	wide?: boolean;
	hidden?: boolean;
	options?: SelectOption[];
	// 仅当所属评论类型为指定值时显示（用于评论系统按类型动态显隐）
	cmt?: string;
	/** type="records" 且值为数组时的记录字段声明 */
	recordFields?: RecordFieldSpec[];
	/** type="records" 且值为单个对象时的字段声明（单行呈现，字段用 separator 分隔） */
	objectFields?: RecordFieldSpec[];
	/** type="records" 且值为「分组含子项」的两级结构：父级字段 */
	groupFields?: RecordFieldSpec[];
	/** type="records" 两级结构的子项字段（缩进行） */
	itemFields?: RecordFieldSpec[];
	/** 两级结构子项的缩进前缀，默认两个空格 */
	indent?: string;
	/** type="records" 时的行内分隔符，默认 "|" */
	separator?: string;
}
export interface Group {
	key: string;
	title: string;
	category: "站点配置" | "功能配置" | "页面配置" | "扩展功能";
	fields: Field[];
}

export const CATEGORIES = [
	"站点配置",
	"功能配置",
	"页面配置",
	"扩展功能",
] as const;

// 字体下拉选项：空值表示继承（不单独设置）
const FONT_OPTIONS: SelectOption[] = [
	{ label: "默认（继承正文字体）", value: "" },
	...fontsList.map((f) => ({ label: f.name, value: f.cssVariable })),
];

export const GROUPS: Group[] = [
	{
		key: "basic",
		title: "基本信息",
		category: "站点配置",
		fields: [
			{ name: "title", label: "站点标题", type: "text" },
			{ name: "subtitle", label: "副标题", type: "text" },
			{ name: "description", label: "站点描述", type: "textarea" },
			{ name: "keywords", label: "关键词（逗号分隔）", type: "text" },
			{
				name: "siteUrl",
				label: "站点地址",
				type: "text",
				placeholder: "https://example.com",
			},
			{
				name: "siteStartDate",
				label: "建站日期",
				type: "text",
				placeholder: "2025-01-01",
			},
			{
				name: "timezone",
				label: "时区",
				type: "text",
				placeholder: "Asia/Shanghai",
			},
			{
				name: "hue",
				label: "主题色相 (0-360)",
				type: "number",
				hint: "改变全局主题色",
			},
			{
				name: "defaultMode",
				label: "默认主题模式",
				type: "select",
				options: [
					{ label: "跟随系统", value: "system" },
					{ label: "浅色", value: "light" },
					{ label: "深色", value: "dark" },
				],
			},
			{
				name: "pageWidth",
				label: "页面宽度 (%)",
				type: "number",
				hint: "默认 100",
			},
			{ name: "categoryBar", label: "显示分类栏", type: "boolean" },
			{
				name: "categoryStyle",
				label: "分类样式",
				type: "select",
				options: [
					{ label: "矩形", value: "rectangle" },
					{ label: "胶囊", value: "pill" },
				],
			},
			{
				name: "tagStyle",
				label: "标签样式",
				type: "select",
				options: [
					{ label: "胶囊", value: "pill" },
					{ label: "灰色胶囊", value: "pill-gray" },
					{ label: "矩形", value: "rectangle" },
				],
			},
			{ name: "pageFriends", label: "页面开关：友链", type: "boolean" },
			{ name: "pageGuestbook", label: "页面开关：留言板", type: "boolean" },
			{ name: "pageDynamic", label: "页面开关：动态", type: "boolean" },
			{ name: "pageGallery", label: "页面开关：相册", type: "boolean" },
			{ name: "pageBooknav", label: "页面开关：书签导航", type: "boolean" },
			{ name: "pageBilibili", label: "页面开关：哔哩哔哩", type: "boolean" },
			{ name: "pageBangumi", label: "页面开关：番组计划", type: "boolean" },
			{ name: "pageVndb", label: "页面开关：VNDB", type: "boolean" },
			{ name: "pageMal", label: "页面开关：MyAnimeList", type: "boolean" },
			{ name: "pageSponsor", label: "页面开关：打赏", type: "boolean" },
			{ name: "cardBorder", label: "卡片边框", type: "boolean" },
			{ name: "cardFollowTheme", label: "卡片跟随主题", type: "boolean" },
			{
				name: "cardRadius",
				label: "卡片圆角 (rem)",
				type: "number",
				hint: "前台所有卡片的圆角半径，默认 1（如 0 为直角、2 为更大圆角）",
			},
			{ name: "faviconUrl", label: "网站图标 URL", type: "text" },
		],
	},
	{
		key: "panel",
		title: "显示设置面板",
		category: "站点配置",
		fields: [
			{ name: "enable", label: "启用设置面板", type: "boolean" },
			{ name: "themeColorSwitchable", label: "主题色可调", type: "boolean" },
			{ name: "layoutSwitchable", label: "布局可调", type: "boolean" },
			{ name: "cardBorderSwitchable", label: "卡片边框可调", type: "boolean" },
			{
				name: "cardFollowThemeSwitchable",
				label: "卡片跟随主题可调",
				type: "boolean",
			},
			{
				name: "wallpaperModeSwitchable",
				label: "壁纸模式可调",
				type: "boolean",
			},
			{ name: "wavesSwitchable", label: "波浪特效可调", type: "boolean" },
			{ name: "gradientSwitchable", label: "渐变背景可调", type: "boolean" },
			{ name: "bannerTitleSwitchable", label: "横幅标题可调", type: "boolean" },
			{
				name: "bannerCarouselSwitchable",
				label: "横幅轮播可调",
				type: "boolean",
			},
			{ name: "sakuraSwitchable", label: "樱花可调", type: "boolean" },
			{
				name: "overlayOpacitySwitchable",
				label: "壁纸透明度可调",
				type: "boolean",
			},
			{
				name: "overlayBlurSwitchable",
				label: "背景模糊度可调",
				type: "boolean",
			},
			{
				name: "overlayCardOpacitySwitchable",
				label: "卡片透明度可调",
				type: "boolean",
			},
		],
	},
	{
		key: "effects",
		title: "特效设置",
		category: "站点配置",
		fields: [
			{ name: "sakura", label: "樱花飘落", type: "boolean" },
			{ name: "sakuraNum", label: "樱花数量", type: "number", hint: "默认 21" },
			{ name: "waves", label: "波浪特效", type: "boolean" },
			{ name: "gradient", label: "渐变背景", type: "boolean" },
			{ name: "bannerCarousel", label: "横幅轮播效果", type: "boolean" },
			{
				name: "limitTimes",
				label: "樱花越界限制次数",
				type: "number",
				placeholder: "-1 无限",
			},
		],
	},
	{
		key: "profile",
		title: "个人资料",
		category: "站点配置",
		fields: [
			{ name: "name", label: "昵称 / 作者", type: "text" },
			{ name: "avatar", label: "头像 URL", type: "text" },
			{ name: "bio", label: "个人简介", type: "textarea" },
			{ name: "location", label: "所在地", type: "text" },
			{ name: "email", label: "邮箱", type: "text" },
			{
				name: "links",
				label: "社交链接",
				type: "records",
				hidden: true,
				recordFields: [
					{ key: "name", label: "名称", required: true },
					{ key: "url", label: "链接", required: true },
					{ key: "icon", label: "图标" },
					{
						key: "showName",
						label: "显示名称(true/false)",
						valueType: "boolean",
					},
				],
				placeholder:
					"每行一个，字段顺序：名称 | 链接 | 图标 | 显示名称(true/false)\n如：GitHub | https://github.com/x | fa7-brands:github | true",
			},
		],
	},
	{
		key: "theme",
		title: "背景壁纸",
		category: "站点配置",
		fields: [
			{
				name: "mode",
				label: "壁纸模式",
				type: "select",
				options: [
					{ label: "横幅", value: "banner" },
					{ label: "全屏", value: "fullscreen" },
					{ label: "叠加", value: "overlay" },
					{ label: "无", value: "none" },
				],
			},
			{ name: "playerUrl", label: "背景视频播放地址 (mp4)", type: "text" },
			{
				name: "playerEnable",
				label: "背景视频播放按钮（播放按钮视频开关）",
				type: "boolean",
				hint: "配置视频后导航栏显示播放按钮",
			},
			{
				name: "bannerUrl",
				label: "桌面壁纸图片 URL（多张用逗号分隔）",
				type: "text",
			},
			{
				name: "mobileImages",
				label: "移动壁纸图片 URL（多张用逗号分隔）",
				type: "text",
			},
			{
				name: "dimOpacity",
				label: "壁纸遮罩暗度 (0-1)",
				type: "number",
				hint: "越大越暗",
			},
			{
				name: "playerMode",
				label: "多视频播放模式",
				type: "select",
				options: [
					{ label: "顺序", value: "order" },
					{ label: "随机", value: "random" },
				],
			},
			{ name: "homeTextEnable", label: "主页横幅文字", type: "boolean" },
			{ name: "homeTitle", label: "主页横幅主标题", type: "text" },
			{
				name: "homeTitleSize",
				label: "主标题字号",
				type: "text",
				placeholder: "4.5rem",
			},
			{
				name: "homeSubtitles",
				label: "主页副标题",
				type: "records",
				recordFields: [{ key: "", label: "副标题" }],
				placeholder: "每行一条，如：In Reddened Chrysalis, I Once Rest",
			},
			{
				name: "homeSubtitleSize",
				label: "副标题字号",
				type: "text",
				placeholder: "1.5rem",
			},
			{
				name: "typewriter",
				label: "打字机效果",
				type: "boolean",
				hint: "开启=循环显示副标题；关闭=随机一条",
			},
			{
				name: "typewriterSpeed",
				label: "打字速度 (ms)",
				type: "number",
				hint: "默认 100",
			},
			{
				name: "typewriterDeleteSpeed",
				label: "删除速度 (ms)",
				type: "number",
				hint: "默认 50",
			},
			{
				name: "typewriterPauseTime",
				label: "暂停时间 (ms)",
				type: "number",
				hint: "默认 2000",
			},
			{ name: "carousel", label: "横幅轮播", type: "boolean" },
			{
				name: "carouselInterval",
				label: "轮播间隔 (ms)",
				type: "number",
				hint: "默认 5000",
			},
			{
				name: "carouselTransition",
				label: "轮播过渡效果",
				type: "select",
				options: [
					{ label: "缩放", value: "zoom" },
					{ label: "淡入淡出", value: "fade" },
					{ label: "滑动", value: "slide" },
					{ label: "缓慢缩放", value: "kenburns" },
				],
			},
			{
				name: "overlayOpacity",
				label: "壁纸透明度 (0-1)",
				type: "number",
				hint: "值越小壁纸越淡、越接近背景色",
			},
			{ name: "overlayBlur", label: "背景模糊度 (px)", type: "number" },
			{
				name: "overlayCardOpacity",
				label: "卡片透明度 (0-1)",
				type: "number",
				hint: "卡片背景透明度，值越小越透明",
			},
		],
	},
	{
		key: "sidebar",
		title: "侧边栏",
		category: "站点配置",
		fields: [
			{ name: "showProfile", label: "个人资料卡片", type: "boolean" },
			{ name: "showAnnouncement", label: "公告卡片", type: "boolean" },
			{ name: "showMusic", label: "音乐播放器卡片", type: "boolean" },
			{ name: "showCategories", label: "分类卡片", type: "boolean" },
			{ name: "showTags", label: "标签卡片", type: "boolean" },
			{ name: "showCalendar", label: "日历卡片", type: "boolean" },
			{
				name: "hideSidebarOnPostPage",
				label: "文章页隐藏侧边栏",
				type: "boolean",
			},
			{
				name: "showBothSidebarsOnPostPage",
				label: "文章页显示双栏",
				type: "boolean",
			},
		],
	},

	{
		key: "font",
		title: "字体",
		category: "功能配置",
		fields: [
			{
				name: "scale",
				label: "字体缩放 (%)",
				type: "number",
				hint: "默认 100",
			},
			{ name: "enable", label: "启用自定义字体", type: "boolean" },
			{
				name: "bannerTitleFont",
				label: "横幅标题字体",
				type: "select",
				options: FONT_OPTIONS,
			},
			{
				name: "bannerSubtitleFont",
				label: "横幅副标题字体",
				type: "select",
				options: FONT_OPTIONS,
			},
			{
				name: "navbarTitleFont",
				label: "导航栏标题字体",
				type: "select",
				options: FONT_OPTIONS,
			},
			{
				name: "codeFont",
				label: "代码字体",
				type: "select",
				options: FONT_OPTIONS,
			},
		],
	},
	{
		key: "comment",
		title: "评论系统",
		category: "功能配置",
		fields: [
			{ name: "enabled", label: "启用评论", type: "boolean" },
			{
				name: "type",
				label: "评论类型",
				type: "select",
				options: [
					{ label: "Twikoo", value: "twikoo" },
					{ label: "Giscus", value: "giscus" },
					{ label: "Waline", value: "waline" },
					{ label: "Artalk", value: "artalk" },
					{ label: "Disqus", value: "disqus" },
				],
			},
			// Twikoo：环境 ID + JS 地址
			{
				name: "twikooEnvId",
				label: "Twikoo 环境 ID",
				type: "text",
				cmt: "twikoo",
				placeholder: "https://xxx.vercel.app",
			},
			{
				name: "twikooJsUrl",
				label: "Twikoo JS 地址",
				type: "text",
				cmt: "twikoo",
				placeholder:
					"https://cdn.jsdelivr.net/npm/twikoo/dist/twikoo.all.min.js",
			},
			// Giscus：仓库 + 分类（Repo ID / 分类 ID 供前端使用）
			{
				name: "giscusRepo",
				label: "Giscus 仓库 (owner/repo)",
				type: "text",
				cmt: "giscus",
				placeholder: "owner/repo",
			},
			{
				name: "giscusRepoId",
				label: "Giscus Repo ID",
				type: "text",
				cmt: "giscus",
			},
			{
				name: "giscusCategory",
				label: "Giscus 分类",
				type: "text",
				cmt: "giscus",
			},
			{
				name: "giscusCategoryId",
				label: "Giscus 分类 ID",
				type: "text",
				cmt: "giscus",
			},
			// Waline：服务地址
			{
				name: "walineServer",
				label: "Waline 服务地址",
				type: "text",
				cmt: "waline",
				placeholder: "https://waline.vercel.app",
			},
			// Disqus：Shortname
			{
				name: "disqusShortname",
				label: "Disqus Shortname",
				type: "text",
				cmt: "disqus",
			},
			// Artalk：服务地址 + 站点名
			{
				name: "artalkServer",
				label: "Artalk 服务地址",
				type: "text",
				cmt: "artalk",
				placeholder: "https://artalk.example.com/",
			},
			{
				name: "artalkSiteName",
				label: "Artalk 站点名",
				type: "text",
				cmt: "artalk",
			},
		],
	},
	{
		key: "cover",
		title: "封面图片",
		category: "功能配置",
		fields: [
			{ name: "enable", label: "启用封面", type: "boolean" },
			{ name: "defaultImage", label: "默认封面 URL", type: "text" },
			{ name: "configurable", label: "文章可自定义封面", type: "boolean" },
			{ name: "showLoading", label: "加载动画", type: "boolean" },
			{ name: "enableInPost", label: "文章页显示封面图", type: "boolean" },
			{
				name: "enableInPostOverlay",
				label: "封面图叠加标题布局",
				type: "boolean",
			},
			{
				name: "randomCoverImage",
				label: "随机封面图配置",
				type: "records",
				objectFields: [
					{ key: "enable", label: "启用(true/false)", valueType: "boolean" },
					{ key: "apis", label: "接口列表(逗号分隔)", valueType: "list" },
				],
				placeholder:
					"单行填写，字段顺序：启用(true/false) | 接口列表(逗号分隔)\n如：false | https://t.alcy.cc/pc,https://www.dmoe.cc/random.php",
			},
		],
	},
	{
		key: "music",
		title: "音乐播放器",
		category: "功能配置",
		fields: [
			{ name: "enabled", label: "启用音乐播放器", type: "boolean" },
			{ name: "showInNavbar", label: "导航栏显示播放器入口", type: "boolean" },
			{ name: "showInSidebar", label: "侧边栏显示播放器组件", type: "boolean" },
			{
				name: "mode",
				label: "使用方式",
				type: "select",
				options: [
					{ label: "本地音乐（用下方音乐列表）", value: "local" },
					{ label: "在线平台（Meting API）", value: "meting" },
				],
			},
			{
				name: "volume",
				label: "默认音量 (0-1)",
				type: "number",
				hint: "默认 0.7",
			},
			{
				name: "playMode",
				label: "播放模式",
				type: "select",
				options: [
					{ label: "列表循环", value: "list" },
					{ label: "单曲循环", value: "one" },
					{ label: "随机播放", value: "random" },
				],
			},
			{ name: "showLyrics", label: "启用歌词显示", type: "boolean" },
			{ name: "autoplay", label: "自动播放", type: "boolean" },
			{ name: "metingApi", label: "Meting API 地址", type: "text" },
			{
				name: "metingServer",
				label: "音乐平台",
				type: "select",
				options: [
					{ label: "网易云", value: "netease" },
					{ label: "QQ音乐", value: "tencent" },
					{ label: "酷狗", value: "kugou" },
					{ label: "虾米", value: "xiami" },
					{ label: "百度", value: "baidu" },
				],
			},
			{
				name: "metingType",
				label: "Meting 类型",
				type: "select",
				options: [
					{ label: "单曲", value: "song" },
					{ label: "歌单", value: "playlist" },
					{ label: "专辑", value: "album" },
					{ label: "搜索", value: "search" },
					{ label: "歌手", value: "artist" },
				],
			},
			{ name: "metingId", label: "歌单/专辑/单曲 ID", type: "text" },
			{ name: "metingAuth", label: "Meting 认证 token", type: "text" },
			{
				name: "metingFallbackApis",
				label: "备用 API",
				type: "records",
				recordFields: [{ key: "", label: "API 地址" }],
				placeholder:
					"每行一个，如：https://api.injahow.cn/meting/?server=:server&type=:type&id=:id",
			},
			{
				name: "sourceScript",
				label: "音源解析脚本",
				type: "select",
				options: [{ label: "K×H v1.7.16（内置）", value: "kh-v1.7.16" }],
				hint: "新增音源脚本放入 src/music-sources/ 后在此追加选项",
			},
			{
				name: "localPlaylist",
				label: "本地音乐列表",
				type: "records",
				recordFields: [
					{ key: "name", label: "歌名", required: true },
					{ key: "artist", label: "歌手" },
					{
						key: "source",
						label: "音源",
						options: ["tx", "wy", "kw", "kg", "mg"],
					},
					{ key: "id", label: "歌曲ID或歌曲页链接" },
					{ key: "quality", label: "音质", options: ["128k", "320k", "flac"] },
					{ key: "url", label: "直链(本地路径)" },
					{ key: "cover", label: "封面" },
					{ key: "lrc", label: "歌词" },
				],
				placeholder:
					"每行一首，字段顺序：歌名 | 歌手 | 音源 | 歌曲ID或歌曲页链接 | 音质 | 直链 | 封面 | 歌词\n音源可选 tx/wy/kw/kg/mg；歌曲ID 可填平台歌曲 ID 或 QQ音乐/网易云的歌曲页链接（自动识别）；填了音源+歌曲ID 即按音源解析，填了直链则直接播放",
			},
		],
	},
	{
		key: "mermaid",
		title: "Mermaid 图表",
		category: "功能配置",
		fields: [{ name: "enabled", label: "启用", type: "boolean" }],
	},
	{
		key: "plantuml",
		title: "PlantUML 图表",
		category: "功能配置",
		fields: [
			{ name: "enable", label: "启用", type: "boolean" },
			{ name: "server", label: "服务地址", type: "text" },
			{ name: "lightTheme", label: "浅色主题", type: "text" },
			{ name: "darkTheme", label: "深色主题", type: "text" },
		],
	},
	{
		key: "expressiveCode",
		title: "代码块主题",
		category: "功能配置",
		fields: [
			{ name: "darkTheme", label: "暗色主题", type: "text" },
			{ name: "lightTheme", label: "亮色主题", type: "text" },
		],
	},
	{
		key: "bilibili",
		title: "哔哩哔哩",
		category: "页面配置",
		fields: [
			{ name: "enabled", label: "启用 B 站页面", type: "boolean" },
			{ name: "uid", label: "B 站 UID", type: "text" },
			{ name: "title", label: "页面标题", type: "text" },
		],
	},
	{
		key: "sponsor",
		title: "打赏",
		category: "页面配置",
		fields: [
			{ name: "enabled", label: "启用打赏", type: "boolean" },
			{ name: "title", label: "打赏标题", type: "text" },
			{
				name: "sponsors",
				label: "打赏者列表",
				type: "records",
				recordFields: [
					{ key: "name", label: "名称", required: true },
					{ key: "avatar", label: "头像链接" },
					{ key: "amount", label: "金额" },
					{ key: "date", label: "日期" },
				],
				placeholder:
					"每行一位，字段顺序：名称 | 头像链接 | 金额 | 日期\n如：夏叶 | https://…/avatar.png | ¥50 | 2025-10-01",
			},
			{ name: "description", label: "打赏描述", type: "textarea" },
			{ name: "usage", label: "打赏用途说明", type: "textarea" },
			{ name: "showButtonInPost", label: "文章内打赏按钮", type: "boolean" },
			{ name: "showSponsorsList", label: "赞助列表", type: "boolean" },
		],
	},
	{
		key: "vndb",
		title: "VNDB",
		category: "页面配置",
		fields: [
			{ name: "enabled", label: "启用 VNDB 页面", type: "boolean" },
			{ name: "username", label: "VNDB 用户名", type: "text" },
		],
	},
	{
		key: "myanimelist",
		title: "MyAnimeList",
		category: "页面配置",
		fields: [
			{ name: "enabled", label: "启用 MAL 页面", type: "boolean" },
			{ name: "username", label: "MAL 用户名", type: "text" },
		],
	},
	{
		key: "bangumi",
		title: "番组计划",
		category: "页面配置",
		fields: [
			{ name: "enabled", label: "启用 Bangumi 页面", type: "boolean" },
			{ name: "username", label: "Bangumi 用户名", type: "text" },
		],
	},
	{
		key: "bookmarks",
		title: "书签导航",
		category: "页面配置",
		fields: [
			{ name: "title", label: "页面标题", type: "text" },
			{ name: "description", label: "页面描述", type: "textarea" },
			{
				name: "groups",
				label: "书签分组与条目",
				type: "records",
				wide: true,
				groupFields: [
					{ key: "name", label: "分组名", required: true },
					{ key: "icon", label: "分组图标" },
					{ key: "desc", label: "分组描述" },
					{ key: "weight", label: "权重", valueType: "number" },
					{ key: "enabled", label: "启用(true/false)", valueType: "boolean" },
					{ key: "id", label: "分组ID" },
				],
				itemFields: [
					{ key: "title", label: "标题", required: true },
					{ key: "url", label: "链接", required: true },
					{ key: "desc", label: "描述" },
					{ key: "icon", label: "图标" },
					{ key: "weight", label: "权重", valueType: "number" },
					{ key: "enabled", label: "启用(true/false)", valueType: "boolean" },
				],
				placeholder:
					"分组行（顶格）：分组名 | 分组图标 | 分组描述 | 权重 | 启用(true/false) | 分组ID\n子项行（行首缩进两空格）：标题 | 链接 | 描述 | 图标 | 权重 | 启用(true/false)",
			},
			{
				name: "favicon",
				label: "Favicon 自动获取配置",
				type: "records",
				objectFields: [
					{ key: "enabled", label: "启用(true/false)", valueType: "boolean" },
					{ key: "api", label: "接口地址" },
				],
				placeholder:
					"单行填写，字段顺序：启用(true/false) | 接口地址\n如：true | https://a.favicon.im/{domain}",
			},
		],
	},

	{
		key: "footer",
		title: "页脚",
		category: "扩展功能",
		fields: [
			{ name: "enable", label: "启用自定义页脚 HTML", type: "boolean" },
			{ name: "text", label: "页脚文本", type: "text" },
			{ name: "icp", label: "ICP 备案号", type: "text" },
			{
				name: "startYear",
				label: "建站年份",
				type: "text",
				placeholder: "2024",
			},
			{ name: "customHtml", label: "自定义页脚 HTML", type: "text" },
		],
	},
	{
		key: "ads",
		title: "广告",
		category: "扩展功能",
		fields: [
			{ name: "enabled", label: "启用广告位", type: "boolean" },
			{ name: "adSenseId", label: "AdSense 发布商 ID", type: "text" },
			{ name: "customCode", label: "自定义广告代码", type: "textarea" },
		],
	},
	{
		key: "license",
		title: "许可证",
		category: "扩展功能",
		fields: [
			{ name: "enabled", label: "启用许可声明", type: "boolean" },
			{
				name: "type",
				label: "许可类型",
				type: "text",
				placeholder: "CC BY-NC-SA 4.0",
			},
			{ name: "url", label: "许可链接", type: "text" },
			{
				name: "name",
				label: "许可名称",
				type: "text",
				placeholder: "CC BY-NC-SA 4.0",
			},
			{ name: "icon", label: "许可图标", type: "text" },
		],
	},
	{
		key: "analytics",
		title: "统计分析",
		category: "扩展功能",
		fields: [
			{ name: "googleAnalyticsId", label: "Google Analytics ID", type: "text" },
			{
				name: "microsoftClarityId",
				label: "Microsoft Clarity ID",
				type: "text",
			},
			{ name: "umamiUrl", label: "Umami 地址", type: "text" },
			{ name: "umamiId", label: "Umami 站点 ID", type: "text" },
		],
	},
	{
		key: "pio",
		title: "Live2D / Spine 模型",
		category: "扩展功能",
		fields: [
			{ name: "enabled", label: "启用看板娘", type: "boolean" },
			{
				name: "type",
				label: "模型类型",
				type: "select",
				options: [
					{ label: "Live2D", value: "live2d" },
					{ label: "Spine", value: "spine" },
				],
			},
			{ name: "model", label: "模型 ID / 路径", type: "text" },
			{
				name: "position",
				label: "位置",
				type: "select",
				options: [
					{ label: "左下角", value: "bottom-left" },
					{ label: "右下角", value: "bottom-right" },
				],
			},
			{ name: "size", label: "尺寸", type: "number" },
			{
				name: "opacity",
				label: "看板娘透明度 (0-1)",
				type: "number",
				placeholder: "0-1",
			},
		],
	},
];

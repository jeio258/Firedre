<script lang="ts">
import { onMount } from "svelte";
import { apiJson } from "@/lib/adminApi";
import { registerSaveAll } from "@/lib/adminSave";
import { getDraft, clearDraft } from "@/lib/adminDrafts";
// 设置项默认值
import { settingsDefaults as defaultsJson } from "../../config/settings-defaults";

type FieldType = "text" | "number" | "boolean" | "textarea" | "json" | "password" | "select";
interface SelectOption {
	label: string;
	value: string;
}
interface Field {
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
}
interface Group {
	key: string;
	title: string;
	category: "站点配置" | "功能配置" | "页面配置" | "扩展功能";
	fields: Field[];
}

const CATEGORIES = ["站点配置", "功能配置", "页面配置", "扩展功能"] as const;

const GROUPS: Group[] = [

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
				type: "text",
				placeholder: "system / light / dark",
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
				type: "text",
				placeholder: "rectangle / pill / none",
			},
			{
				name: "tagStyle",
				label: "标签样式",
				type: "text",
				placeholder: "pill / rectangle / none",
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
				label: "社交链接（JSON 数组）",
				type: "json",
				hidden: true,
				placeholder: '[{"name":"GitHub","url":"https://github.com/x"}]',
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
				type: "text",
				placeholder: "banner / fullscreen / overlay / none",
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
				type: "text",
				placeholder: "order / random",
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
				label: "主页副标题（JSON 数组）",
				type: "json",
				placeholder: '["In Reddened Chrysalis, I Once Rest"]',
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
				type: "text",
				placeholder: "zoom / fade / …",
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
			{ name: "bannerTitleFont", label: "横幅标题字体", type: "text" },
			{ name: "bannerSubtitleFont", label: "横幅副标题字体", type: "text" },
			{ name: "navbarTitleFont", label: "导航栏标题字体", type: "text" },
			{ name: "codeFont", label: "代码字体", type: "text" },
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
			{ name: "twikooEnvId", label: "Twikoo 环境 ID", type: "text", cmt: "twikoo", placeholder: "https://xxx.vercel.app" },
			{ name: "twikooJsUrl", label: "Twikoo JS 地址", type: "text", cmt: "twikoo", placeholder: "https://cdn.jsdelivr.net/npm/twikoo/dist/twikoo.all.min.js" },
			// Giscus：仓库 + 分类（Repo ID / 分类 ID 供前端使用）
			{ name: "giscusRepo", label: "Giscus 仓库 (owner/repo)", type: "text", cmt: "giscus", placeholder: "owner/repo" },
			{ name: "giscusRepoId", label: "Giscus Repo ID", type: "text", cmt: "giscus" },
			{ name: "giscusCategory", label: "Giscus 分类", type: "text", cmt: "giscus" },
			{ name: "giscusCategoryId", label: "Giscus 分类 ID", type: "text", cmt: "giscus" },
			// Waline：服务地址
			{ name: "walineServer", label: "Waline 服务地址", type: "text", cmt: "waline", placeholder: "https://waline.vercel.app" },
			// Disqus：Shortname
			{ name: "disqusShortname", label: "Disqus Shortname", type: "text", cmt: "disqus" },
			// Artalk：服务地址 + 站点名
			{ name: "artalkServer", label: "Artalk 服务地址", type: "text", cmt: "artalk", placeholder: "https://artalk.example.com/" },
			{ name: "artalkSiteName", label: "Artalk 站点名", type: "text", cmt: "artalk" },
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
			{ name: "enableInPostOverlay", label: "封面图叠加标题布局", type: "boolean" },
			{
				name: "randomCoverImage",
				label: "随机封面图配置（JSON）",
				type: "json",
				wide: true,
				placeholder: '{"enable":false,"apis":["https://t.alcy.cc/pc"]}',
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
				type: "text",
				placeholder: "meting（在线平台）/ local（本地音乐）",
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
				type: "text",
				placeholder: "list / one / random",
			},
			{ name: "showLyrics", label: "启用歌词显示", type: "boolean" },
			{ name: "autoplay", label: "自动播放", type: "boolean" },
			{ name: "metingApi", label: "Meting API 地址", type: "text" },
			{
				name: "metingServer",
				label: "音乐平台",
				type: "text",
				placeholder: "netease / tencent / kugou / xiami / baidu",
			},
			{
				name: "metingType",
				label: "Meting 类型",
				type: "text",
				placeholder: "song / playlist / album / search / artist",
			},
			{ name: "metingId", label: "歌单/专辑/单曲 ID", type: "text" },
			{ name: "metingAuth", label: "Meting 认证 token", type: "text" },
			{
				name: "metingFallbackApis",
				label: "备用 API（JSON 数组）",
				type: "json",
				placeholder: '["https://api.injahow.cn/meting/…"]',
			},
			{
				name: "localPlaylist",
				label: "本地音乐列表（JSON 数组）",
				type: "json",
				placeholder:
					'[{"name":"歌名","artist":"歌手","url":"/assets/…mp3","cover":"/assets/…","lrc":""}]',
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
			{ name: "description", label: "打赏描述", type: "textarea" },
			{ name: "usage", label: "打赏用途说明", type: "textarea" },
			{ name: "showButtonInPost", label: "文章内打赏按钮", type: "boolean" },
			{ name: "showSponsorsList", label: "赞助列表", type: "boolean" },
			{ name: "sponsors", label: "打赏者列表（JSON）", type: "json", wide: true },
		],
	},
	{
		key: "dynamic",
		title: "动态",
		category: "页面配置",
		fields: [
			{ name: "memos", label: "Memos 数据源（JSON）", type: "json", wide: true },
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
				label: "书签分组与条目（JSON 数组）",
				type: "json",
				wide: true,
				placeholder:
					'[{"id":"dev","name":"开发","icon":"material-symbols:code-rounded","desc":"","weight":100,"items":[{"title":"GitHub","url":"https://github.com","desc":"","icon":"","weight":10}]}]',
			},
			{
				name: "favicon",
				label: "Favicon 自动获取配置（JSON）",
				type: "json",
				placeholder: '{"enabled":true,"api":"https://a.favicon.im/{domain}"}',
			},
		],
	},

	{
		key: "friends",
		title: "友链页",
		category: "页面配置",
		fields: [
			{ name: "title", label: "页面标题", type: "text" },
			{ name: "description", label: "页面描述", type: "textarea" },
			{ name: "showCustomContent", label: "显示底部自定义内容", type: "boolean" },
			{ name: "showComment", label: "显示评论区", type: "boolean" },
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
			{ name: "customHtml", label: "自定义页脚 HTML", type: "textarea" },
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
				type: "text",
				placeholder: "live2d / spine",
			},
			{ name: "model", label: "模型 ID / 路径", type: "text" },
			{
				name: "position",
				label: "位置",
				type: "text",
				placeholder: "bottom-left / bottom-right",
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

let data: Record<string, Record<string, unknown>> = {};
let loading = true;
let loadError = "";
let saving = false;
let message = "";
let loaded = false;

export let cat = 0;
let activeCat: string = CATEGORIES[typeof cat === "number" ? cat : 0];
// 当前分类下的分组
let groups: Group[] = [];
// 当前选中的分组
let activeGroup = "";
// 当前选中的评论类型（独立响应式变量，供显隐逻辑直接引用）
let cmtTypeVal = "";

$: {
	const c = CATEGORIES[typeof cat === "number" ? cat : 0];
	activeCat = c;
	groups = GROUPS.filter((g) => g.category === c);
	// 分类切换时，重置到该分类首分组
	if (!groups.some((g) => g.key === activeGroup)) {
		activeGroup = groups[0]?.key ?? "";
	}
}

async function load() {
	try {
		const all = (await apiJson("/api/settings/")) as Record<
			string,
			Record<string, unknown>
		>;
		const defaults = defaultsJson as unknown as Record<
			string,
			Record<string, unknown>
		>;
		for (const g of GROUPS) {
			const saved = all[g.key] ?? {};
			const def = defaults[g.key] ?? {};
			const merged: Record<string, unknown> = {};
			for (const f of g.fields) {
				const v = saved[f.name];
				merged[f.name] = v !== undefined ? v : def[f.name];
			}
			data[g.key] = merged;
		}
		data["nav"] = { ...(defaults["nav"] ?? {}), ...(all["nav"] ?? {}) };
		cmtTypeVal = String(data["comment"]?.["type"] ?? "");
	} catch {
		loadError = "设置加载失败，请刷新重试";
	}
	loading = false;
	loaded = true;
}

function cycleBool(key: string, field: string) {
	data[key][field] = !data[key][field];
	markDirty();
}

// 标记存在未保存修改
function markDirty() {
	if (!loaded) return;
	message = "有未保存的修改，请点击「保存全部」";
}

// 字段是否可见：带 cmt 标签的字段仅在该评论类型选中时显示
function isFieldVisible(field: Field, t: string = cmtTypeVal): boolean {
	if (field.hidden) return false;
	if (field.cmt) return field.cmt === t;
	return true;
}

// 个人资料面板：为 bio/所在地/邮箱 分配 grid-area，使简介居左、所在地与邮箱居右
function profileArea(group: Group, field: Field): string {
	if (group.key !== "profile") return "";
	if (field.name === "bio") return "ar-bio";
	if (field.name === "location") return "ar-loc";
	if (field.name === "email") return "ar-eml";
	if (field.name === "name") return "ar-name";
	if (field.name === "avatar") return "ar-avatar";
	return "";
}

async function save() {
	saving = true;
	message = "";
	try {
		const out: Record<string, Record<string, unknown>> = {};

		const jsonFields = new Set([
			"links",
			"homeSubtitles",
			"metingFallbackApis",
			"localPlaylist",
			"sections",
			"groups",
			"favicon",
			"randomCoverImage",
			"sponsors",
			"memos",
		]);

		for (const g of GROUPS) {
			const payload = { ...(data[g.key] ?? {}) };
			for (const k of Object.keys(payload)) {
				const v = payload[k];
				if (jsonFields.has(k)) {
					if (v === "" || v == null) delete payload[k];
				} else if (v == null) {
					delete payload[k];
				}
			}
			out[g.key] = payload;
		}
		out["nav"] = { ...(data["nav"] ?? {}) };
		const resp = await fetch("/api/settings/", {
			method: "PUT",
			credentials: "include",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ groups: out }),
		});
		const res = await resp.json().catch(() => null);
		if (!resp.ok || !res?.ok) {
			message = `保存失败：${(res && res.message) || resp.status || ""}`;
			return;
		}
		message = `已保存 ✓ ${new Date().toLocaleTimeString()}`;
		clearDraft("站点设置");

		applyHueToAdmin(groups["basic"]?.hue);
	} catch {
		message = "网络错误，修改尚未保存";
	} finally {
		saving = false;
	}
}

function applyHueToAdmin(hue: unknown) {
	if (typeof document === "undefined") return;

	if (hue == null || hue === "") return;
	const h = Number(hue);
	if (!Number.isFinite(h) || h < 0 || h > 360) return;
	// 仅更新主题色相
	document.documentElement.style.setProperty("--hue", String(h));
	document.body.style.background =
		getComputedStyle(document.documentElement).getPropertyValue("--page-bg").trim();
}

// 暴露给顶栏「保存全部」
onMount(async () => {
	await load();
	const d = getDraft<Record<string, Record<string, unknown>>>("站点设置");
	if (d) {
		data = d;
		clearDraft("站点设置");
	}
	return registerSaveAll("站点设置", save, () => data);
});
</script>

<div class="crud-page">
	<div class="settings-head">
		<div class="settings-t">
			<h2 class="settings-title">站点设置</h2>
			<span class="settings-count">{activeCat} · {groups.length} 个分组</span>
		</div>
		<p class="settings-note">
			在左侧「系统 → 站点设置」下选择配置大类，再点击上方分组标签进行编辑；修改后点右上角「保存全部」统一生效。
		</p>
		<div class="settings-nav">
			{#each groups as g (g.key)}
				<button class="sn" class:on={activeGroup === g.key} on:click={() => (activeGroup = g.key)}>{g.title}</button>
			{/each}
		</div>
	</div>

	{#if message}
		<div class="save-msg" class:err={/失败|错误/.test(message)} role="status">{message}</div>
	{/if}

	{#if loading}
		<div class="crud-empty">加载中…</div>
	{:else if loadError}
		<div class="crud-empty danger">{loadError}</div>
	{:else}
		<!-- 当前分类下，按选中的分组标签展示单张卡片 -->
		<div class="s2-host">
			<section class="s2pane on">
				{#each groups.filter((g) => g.key === activeGroup) as group (group.key)}
					<section class="a2card" class:profile={group.key === "profile"}>
						<header>
							<h4>{group.title}</h4>
							<span class="cnt">{group.fields.filter((f) => isFieldVisible(f, cmtTypeVal)).length} 项</span>
						</header>
						{#if group.fields.some((f) => isFieldVisible(f, cmtTypeVal) && f.type === "boolean")}
							<div class="a2sws">
								{#each group.fields.filter((f) => isFieldVisible(f, cmtTypeVal) && f.type === "boolean") as field (field.name)}
									<label class="a2tr">
										<span class="a2tx">{field.label}</span>
										<button
											class="sw"
											class:on={data[group.key]?.[field.name] === true}
											aria-label={field.label}
											on:click={() => cycleBool(group.key, field.name)}
										></button>
									</label>
								{/each}
							</div>
						{/if}
						{#if group.fields.some((f) => isFieldVisible(f, cmtTypeVal) && f.type !== "boolean")}
							<div class="a2fg">
								{#each group.fields.filter((f) => isFieldVisible(f, cmtTypeVal) && f.type !== "boolean") as field (field.name)}
									<div class="a2f {field.wide ? 'w' : ''} {profileArea(group, field)}">
										<label>{field.label}{#if field.hint}<small>{field.hint}</small>{/if}</label>
										{#if field.type === "select"}
											<select on:change={(e) => { const v = e.currentTarget.value; data[group.key][field.name] = v; cmtTypeVal = v; markDirty(); }}>
												{#each field.options ?? [] as opt}
													<option value={opt.value} selected={((data[group.key]?.[field.name] as string) ?? "") === opt.value}>{opt.label}</option>
												{/each}
											</select>
										{:else if field.type === "textarea" || field.type === "json"}
											<textarea rows={field.type === "json" ? 5 : 3} value={(data[group.key]?.[field.name] as string) ?? ""} placeholder={field.placeholder} on:input={(e) => { data[group.key][field.name] = e.currentTarget.value; markDirty(); }}></textarea>
											{#if field.type === "json"}
												<small class="json-hint">JSON 数组格式；留空使用模板默认值</small>
											{/if}
										{:else if field.type === "password"}
											<input type="password" value={(data[group.key]?.[field.name] as string) ?? ""} placeholder={field.placeholder} autocomplete="off" on:input={(e) => { data[group.key][field.name] = e.currentTarget.value; markDirty(); }} />
										{:else if field.type === "number"}
											<input type="number" value={(data[group.key]?.[field.name] as number) ?? ""} on:input={(e) => { data[group.key][field.name] = e.currentTarget.valueAsNumber; markDirty(); }} />
										{:else}
											<input type="text" value={(data[group.key]?.[field.name] as string) ?? ""} placeholder={field.placeholder} on:input={(e) => { data[group.key][field.name] = e.currentTarget.value; markDirty(); }} />
										{/if}
									</div>
								{/each}
							</div>
						{/if}
					</section>
				{/each}
			</section>
		</div>
	{/if}
</div>


<style>
	.crud-empty.danger {
		color: var(--danger);
		border-color: color-mix(in oklch, var(--danger) 40%, var(--line-divider));
	}

	.save-msg {
		margin: 0 0 0.8rem;
		padding: 0.55rem 0.9rem;
		border-radius: var(--radius-medium);
		font-size: 0.85rem;
		font-weight: 600;
		background: color-mix(in oklch, var(--primary) 12%, transparent);
		color: var(--primary);
		border: 1px solid color-mix(in oklch, var(--primary) 30%, transparent);
	}
	.save-msg.err {
		background: color-mix(in oklch, var(--danger) 12%, transparent);
		color: var(--danger);
		border-color: color-mix(in oklch, var(--danger) 30%, transparent);
	}

	.json-hint {
		color: var(--text-muted);
		font-size: 0.72rem;
		font-family: ui-monospace, monospace;
	}
</style>

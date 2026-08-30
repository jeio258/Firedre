<script lang="ts">
import { onMount } from "svelte";
// Firefly 静态配置的默认值（后台开关初始显示真实当前状态）
import defaultsJson from "../../config/settings-defaults.json";

type FieldType = "text" | "number" | "boolean" | "textarea" | "json";
interface Field {
	name: string;
	label: string;
	type: FieldType;
	placeholder?: string;
	hint?: string;
}
interface Group {
	key: string;
	title: string;
	category: "站点配置" | "功能配置" | "页面配置" | "扩展功能";
	fields: Field[];
}

const CATEGORIES = ["站点配置", "功能配置", "页面配置", "扩展功能"] as const;

const GROUPS: Group[] = [
	// ── 站点配置 ──
	{
		key: "basic",
		title: "站点配置",
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
			{ name: "overlayOpacitySwitchable", label: "壁纸透明度可调", type: "boolean" },
			{ name: "overlayBlurSwitchable", label: "背景模糊度可调", type: "boolean" },
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
			{
				name: "playerEnable",
				label: "背景视频播放按钮（播放按钮视频开关）",
				type: "boolean",
				hint: "配置视频后导航栏显示播放按钮",
			},
			{
				name: "bannerUrl",
				label: "桌面壁纸图片 URL（多张用逗号分隔）",
				type: "textarea",
			},
			{
				name: "mobileImages",
				label: "移动壁纸图片 URL（多张用逗号分隔）",
				type: "textarea",
			},
			{ name: "playerUrl", label: "背景视频播放地址 (mp4)", type: "text" },
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
	// ── 功能配置 ──
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
				label: "类型",
				type: "text",
				placeholder: "giscus / waline / disqus / none",
			},
			{
				name: "giscusRepo",
				label: "Giscus 仓库",
				type: "text",
				placeholder: "owner/repo",
			},
			{ name: "giscusRepoId", label: "Giscus Repo ID", type: "text" },
			{ name: "giscusCategory", label: "Giscus 分类", type: "text" },
			{ name: "giscusCategoryId", label: "Giscus 分类 ID", type: "text" },
			{ name: "walineServer", label: "Waline 服务地址", type: "text" },
			{ name: "disqusShortname", label: "Disqus Shortname", type: "text" },
			{ name: "twikooEnvId", label: "Twikoo 环境 ID", type: "text" },
			{ name: "twikooJsUrl", label: "Twikoo JS 地址", type: "text" },
			{ name: "artalkServer", label: "Artalk 服务地址", type: "text" },
			{ name: "artalkSiteName", label: "Artalk 站点名", type: "text" },
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
		fields: [
			{ name: "enabled", label: "启用", type: "boolean" },
		],
	},
	{
		key: "dynamic",
		title: "动态",
		category: "页面配置",
		fields: [
			{ name: "enabled", label: "启用动态页", type: "boolean" },
			{ name: "title", label: "页面标题", type: "text" },
			{ name: "description", label: "页面描述", type: "textarea" },
			{ name: "profileUrl", label: "头像跳转地址", type: "text" },
			{ name: "showComment", label: "动态显示评论", type: "boolean" },
			{ name: "itemsPerPage", label: "每页条数", type: "number" },
			{
				name: "apiUrl",
				label: "数据接口",
				type: "text",
				placeholder: "/api/dynamic.json",
			},
		],
	},
	{
		key: "friends",
		title: "友链",
		category: "页面配置",
		fields: [
			{ name: "enabled", label: "启用友链页", type: "boolean" },
			{ name: "title", label: "页面标题", type: "text" },
			{ name: "description", label: "页面描述", type: "textarea" },
		],
	},
	{
		key: "gallery",
		title: "相册",
		category: "页面配置",
		fields: [
			{ name: "enabled", label: "启用相册页", type: "boolean" },
			{ name: "title", label: "页面标题", type: "text" },
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
			{ name: "description", label: "打赏描述", type: "textarea" },
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
		],
	},

	// ── 扩展功能 ──
	{
		key: "announcement",
		title: "公告",
		category: "扩展功能",
		fields: [
			{ name: "enabled", label: "启用公告", type: "boolean" },
			{ name: "title", label: "公告标题", type: "text" },
			{
				name: "sections",
				label: "公告内容（JSON 数组）",
				type: "json",
				placeholder: '[{"title":"标题","content":"内容"}]',
			},
			{ name: "content", label: "公告内容（纯文本）", type: "textarea" },
			{ name: "closable", label: "可关闭", type: "boolean" },
			{ name: "link", label: "公告链接", type: "text" },
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

// 导航数组（nav 组）
let navItems: Array<{ label: string; url: string }> = [];
let social: Array<{ label: string; url: string }> = [];

let data: Record<string, Record<string, unknown>> = {};
let loading = true;
let saving = false;
let message = "";
let activeGroup = "basic";
let activeCategory = "站点配置";
let loaded = false;

function currentGroup() {
	return GROUPS.find((g) => g.key === activeGroup) ?? GROUPS[0];
}

function selectGroup(key: string) {
	activeGroup = key;
}

async function load() {
	try {
		const resp = await fetch("/api/settings/", { credentials: "include" });
		if (resp.ok) {
			const all = (await resp.json()) as Record<
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
			data["nav"] = { ...(all["nav"] ?? {}) };
			const nav = data["nav"] as {
				navItems?: Array<{ label: string; url: string }>;
				social?: Array<{ label: string; url: string }>;
			};
			navItems = nav.navItems?.length
				? nav.navItems.map((n) => ({ ...n }))
				: [];
			social = nav.social?.length ? nav.social.map((s) => ({ ...s })) : [];
		}
	} catch {
		message = "加载失败";
	}
	loading = false;
	loaded = true;
}

// 布尔开关两态：开 ↔ 关（load 时已填充 Firefly 真实默认值，关=必隐藏）
function cycleBool(key: string, field: string) {
	data[key][field] = !data[key][field];
	markDirty();
}

function addNav() {
	navItems = [...navItems, { label: "", url: "" }];
	markDirty();
}
function removeNav(i: number) {
	navItems = navItems.filter((_, idx) => idx !== i);
	markDirty();
}
function addSocial() {
	social = [...social, { label: "", url: "" }];
	markDirty();
}
function removeSocial(i: number) {
	social = social.filter((_, idx) => idx !== i);
	markDirty();
}

// 手动保存模式：字段修改仅标记为「未保存」，点击「保存全部」才提交（不再自动保存）
function markDirty() {
	if (!loaded) return;
	message = "有未保存的修改，请点击「保存全部」";
}

async function save() {
	saving = true;
	message = "";
	try {
		const groups: Record<string, Record<string, unknown>> = {};
		for (const g of GROUPS) {
			const payload = { ...(data[g.key] ?? {}) };
			for (const k of Object.keys(payload)) {
				if (payload[k] === "" || payload[k] == null) delete payload[k];
			}
			groups[g.key] = payload;
		}
		groups["nav"] = {
			...(data["nav"] ?? {}),
			navItems: navItems.filter((n) => n.label.trim() && n.url.trim()),
			social: social.filter((s) => s.label.trim() && s.url.trim()),
		};
		const resp = await fetch("/api/settings/", {
			method: "PUT",
			credentials: "include",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ groups }),
		});
		const res = await resp.json().catch(() => null);
		if (!resp.ok || !res?.ok) {
			message = `保存失败：${(res && res.message) || resp.status || ""}`;
			return;
		}
		message = `已保存 ✓ ${new Date().toLocaleTimeString()}`;
		// 保存后立即把主题色相应用到当前后台页面，避免切换/重载时闪回旧主题。
		// variables.styl 的全部主题变量由 --hue 派生，设好 --hue 后台即跟随项目主题。
		applyHueToAdmin(groups["basic"]?.hue);
	} catch {
		message = "网络错误，修改尚未保存";
	} finally {
		saving = false;
	}
}

/** 把 hue 应用到后台 documentElement（--hue 及兜底主题变量）。 */
function applyHueToAdmin(hue: unknown) {
	if (typeof document === "undefined") return;
	const h = Number.isFinite(Number(hue)) ? Number(hue) : undefined;
	if (h == null) return;
	const root = document.documentElement;
	root.style.setProperty("--hue", String(h));
	root.style.setProperty("--primary", `oklch(0.70 0.14 ${h})`);
	root.style.setProperty("--page-bg", `oklch(0.95 0.01 ${h})`);
	root.style.setProperty("--deep-text", `oklch(0.25 0.02 ${h})`);
	root.style.setProperty("--text-1", `oklch(0.25 0.02 ${h})`);
	document.body.style.background = `oklch(0.95 0.01 ${h})`;
}

onMount(load);

const groupOf = (key: string) => GROUPS.find((g) => g.key === key);
const catOf = (key: string) => groupOf(key)?.category ?? "站点配置";
</script>

<div class="settings-app">
	<aside class="settings-nav">
		{#each CATEGORIES as cat}
			<div class="cat-name">{cat}</div>
			{#each GROUPS.filter((g) => g.category === cat) as group}
				<button
					class="nav-item"
					class:active={activeGroup === group.key}
					on:click={() => selectGroup(group.key)}
				>
					{group.title}
				</button>
			{/each}
		{/each}
	</aside>

	<main class="settings-main">
		<div class="settings-header">
			<div>
				<h2>{currentGroup().title}</h2>
				<p class="sub">{currentGroup().key}</p>
			</div>
			<div class="header-actions">
				{#if message}
					<span class="msg">{message}</span>
				{/if}
				<button class="btn-save" on:click={save} disabled={saving}>
					{saving ? "保存中…" : "保存全部"}
				</button>
			</div>
		</div>

		{#if loading}
			<div class="loading">加载中…</div>
		{:else}
			{#if activeGroup === "nav"}
				<div class="card">
					<div class="field">
						<label class="field-label">隐藏整个导航栏</label>
						<div class="switch-wrap">
							<span class="switch-state">{data["nav"]?.enabled === true ? "显示" : "隐藏"}</span>
							<button class="switch" class:on={data["nav"]?.enabled === true}
								title="显示 / 隐藏"
								on:click={() => {
									data["nav"] = { ...(data["nav"] ?? {}), enabled: !(data["nav"]?.enabled === true) };
									markDirty();
								}}>
								<span class="knob"></span>
							</button>
						</div>
					</div>
					<h3>导航栏项目</h3>
					{#each navItems as item, i}
						<div class="row">
							<input type="text" placeholder="名称" value={item.label} on:input={(e) => (item.label = e.currentTarget.value)} />
							<input type="text" placeholder="URL（如 /posts/）" value={item.url} on:input={(e) => (item.url = e.currentTarget.value)} />
							<button class="btn-del" on:click={() => removeNav(i)}>×</button>
						</div>
					{/each}
					<button class="btn-add" on:click={addNav}>+ 添加导航项</button>
					<h3 style="margin-top:1.25rem">社交链接</h3>
					{#each social as item, i}
						<div class="row">
							<input type="text" placeholder="名称（如 GitHub）" value={item.label} on:input={(e) => (item.label = e.currentTarget.value)} />
							<input type="text" placeholder="URL" value={item.url} on:input={(e) => (item.url = e.currentTarget.value)} />
							<button class="btn-del" on:click={() => removeSocial(i)}>×</button>
						</div>
					{/each}
					<button class="btn-add" on:click={addSocial}>+ 添加社交链接</button>
				</div>
			{:else}
				<div class="card">
					{#each currentGroup().fields as field}
						<div class="field">
							<label class="field-label">
								{field.label}
								{#if field.hint}
									<small>{field.hint}</small>
								{/if}
							</label>
							{#if field.type === "boolean"}
								<div class="switch-wrap">
									<span class="switch-state">{data[currentGroup().key][field.name] ? "开" : "关"}</span>
									<button
										class="switch"
										class:on={data[currentGroup().key][field.name] === true}
										title="开 / 关"
										on:click={() => cycleBool(currentGroup().key, field.name)}
									>
										<span class="knob"></span>
									</button>
								</div>
							{:else if field.type === "textarea" || field.type === "json"}
								<textarea rows={field.type === "json" ? 5 : 3} value={data[currentGroup().key][field.name] as string ?? ""} placeholder={field.placeholder} on:input={(e) => { data[currentGroup().key][field.name] = e.currentTarget.value; markDirty(); }}></textarea>
								{#if field.type === "json"}
									<small class="json-hint">JSON 数组格式；留空使用模板默认值</small>
								{/if}
							{:else if field.type === "number"}
								<input type="number" value={data[currentGroup().key][field.name] as number} on:input={(e) => { data[currentGroup().key][field.name] = e.currentTarget.valueAsNumber; markDirty(); }} />
							{:else}
								<input type="text" value={data[currentGroup().key][field.name] as string ?? ""} placeholder={field.placeholder} on:input={(e) => { data[currentGroup().key][field.name] = e.currentTarget.value; markDirty(); }} />
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		{/if}
	</main>
</div>

<style>
	.settings-app {
		display: flex;
		gap: 1.25rem;
		align-items: flex-start;
	}
	.settings-nav {
		width: 210px;
		flex-shrink: 0;
		background: var(--card-bg, #fff);
		border: 1px solid var(--line-divider, #e5e7eb);
		border-radius: var(--radius-large, 1rem);
		padding: 0.9rem 0.6rem;
		position: sticky;
		top: 1.25rem;
		max-height: calc(100vh - 2.5rem);
		overflow-y: auto;
		box-shadow: 0 1px 3px rgb(0 0 0 / 0.04), 0 8px 24px rgb(0 0 0 / 0.04);
	}
	.cat-name {
		font-size: 0.7rem;
		font-weight: 700;
		color: var(--muted, #9ca3af);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 0.9rem 0.75rem 0.35rem;
	}
	.nav-item {
		display: block;
		width: 100%;
		text-align: left;
		background: none;
		border: none;
		padding: 0.5rem 0.75rem;
		border-radius: 0.5rem;
		font-size: 0.88rem;
		color: var(--deep-text, #4b5563);
		cursor: pointer;
		transition: background 0.15s, color 0.15s;
	}
	.nav-item:hover {
		background: var(--btn-regular-bg, #f3f4f6);
		color: var(--deep-text, #111827);
	}
	.nav-item.active {
		background: var(--primary, #5b8cff);
		color: #fff;
		font-weight: 600;
	}
	.settings-main {
		flex: 1;
		min-width: 0;
	}
	.settings-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 1rem;
		position: sticky;
		top: 0.5rem;
		z-index: 20;
		background: var(--page-bg, #f3f4f6);
		padding: 0.75rem 0.25rem;
		border-radius: 0.75rem;
	}
	.settings-header h2 {
		margin: 0;
		font-size: 1.15rem;
		color: var(--deep-text, #111827);
	}
	.sub {
		margin: 0.15rem 0 0;
		font-size: 0.75rem;
		color: var(--muted, #9ca3af);
		font-family: ui-monospace, monospace;
	}
	.header-actions {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}
	.msg {
		color: #16a34a;
		font-size: 0.85rem;
	}
	.btn-save {
		padding: 0.55rem 1.1rem;
		background: linear-gradient(135deg, var(--primary, #5b8cff), var(--title-active, #8b5cf6));
		color: #fff;
		border: none;
		border-radius: 0.55rem;
		font-size: 0.9rem;
		font-weight: 600;
		cursor: pointer;
		box-shadow: 0 2px 8px rgb(91 140 255 / 0.35);
		transition: transform 0.15s, box-shadow 0.15s;
	}
	.btn-save:hover:not(:disabled) {
		transform: translateY(-1px);
		box-shadow: 0 4px 14px rgb(91 140 255 / 0.45);
	}
	.btn-save:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
	.loading {
		padding: 3rem;
		text-align: center;
		color: var(--muted, #9ca3af);
	}
	.card {
		background: var(--card-bg, #fff);
		border: 1px solid var(--line-divider, #e5e7eb);
		border-radius: var(--radius-large, 1rem);
		padding: 1.75rem;
		box-shadow: 0 1px 3px rgb(0 0 0 / 0.04), 0 8px 24px rgb(0 0 0 / 0.04);
	}
	.card h3 {
		margin: 0 0 0.75rem;
		font-size: 0.95rem;
		color: var(--deep-text, #374151);
	}
	.field {
		padding: 0.85rem 0;
		border-bottom: 1px solid var(--line-divider, #f3f4f6);
	}
	.field:last-child {
		border-bottom: none;
	}
	.field-label {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		font-size: 0.88rem;
		color: var(--deep-text, #374151);
		margin-bottom: 0.45rem;
		font-weight: 500;
	}
	.field-label small {
		color: var(--muted, #9ca3af);
		font-weight: 400;
		font-size: 0.75rem;
	}
	input[type="text"], input[type="number"], textarea {
		width: 100%;
		box-sizing: border-box;
		padding: 0.55rem 0.8rem;
		border: 1px solid var(--line-color, #d1d5db);
		border-radius: 0.5rem;
		font-size: 0.9rem;
		transition: border-color 0.15s, box-shadow 0.15s;
		background: var(--btn-regular-bg, #fafafa);
		color: var(--deep-text, inherit);
	}
	input:focus, textarea:focus {
		outline: none;
		border-color: var(--primary, #5b8cff);
		box-shadow: 0 0 0 3px rgb(91 140 255 / 0.15);
		background: var(--card-bg, #fff);
	}
	.switch-wrap {
		display: flex;
		align-items: center;
		justify-content: space-between;
		color: var(--muted, #6b7280);
		font-size: 0.85rem;
	}
	.switch-state { font-size: 0.8rem; font-weight: 600; }
	.switch-state.unset { color: var(--muted, #9ca3af); font-weight: 400; }
	.switch.unset {
		background: var(--line-divider, #e5e7eb);
		opacity: 0.55;
	}
	.switch {
		width: 44px;
		height: 24px;
		border-radius: 12px;
		border: none;
		background: var(--line-divider, #e5e7eb);
		position: relative;
		cursor: pointer;
		transition: background 0.2s;
	}
	.switch.on {
		background: var(--primary, #5b8cff);
	}
	.knob {
		position: absolute;
		top: 3px;
		left: 3px;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: var(--card-bg, #fff);
		box-shadow: 0 1px 3px rgb(0 0 0 / 0.25);
		transition: left 0.2s;
	}
	.switch.on .knob {
		left: 23px;
	}
	.row {
		display: flex;
		gap: 0.6rem;
		margin-bottom: 0.5rem;
	}
	.row input:first-child {
		width: 32%;
	}
	.row input {
		flex: 1;
	}
	.btn-del {
		background: none;
		border: none;
		color: #dc2626;
		cursor: pointer;
		font-size: 1.05rem;
		padding: 0 0.4rem;
	}
	.btn-add {
		background: var(--btn-regular-bg, #f3f4f6);
		border: 1px dashed var(--line-color, #d1d5db);
		border-radius: 0.5rem;
		padding: 0.45rem 0.9rem;
		font-size: 0.85rem;
		color: var(--deep-text, #4b5563);
		cursor: pointer;
	}
	.btn-add:hover {
		border-color: var(--primary, #5b8cff);
		color: var(--primary, #5b8cff);
	}
	.json-hint {
		color: var(--muted, #9ca3af);
		font-size: 0.72rem;
		font-family: ui-monospace, monospace;
	}
</style>

export * from "./types";

import { extensionGroups } from "./extensions";
import { featureGroups } from "./features";
import { pageGroups } from "./pages";
import { siteGroups } from "./site";
import type { Group } from "./types";

// 组显示顺序（按分类聚簇 + 使用频率）——单一显式来源，与源文件物理顺序解耦；
// AdminSettings 按 category 过滤后即按此顺序展示
const GROUP_ORDER = [
	// 站点配置
	"basic",
	"profile",
	// 外观布局
	"nav",
	"sidebar",
	"theme",
	"panel",
	"effects",
	"font",
	"cover",
	"expressiveCode",
	// 功能配置
	"post",
	"comment",
	"music",
	"hitokoto",
	"mermaid",
	"plantuml",
	// 页面配置
	"bilibili",
	"myanimelist",
	"vndb",
	"bangumi",
	"sponsor",
	"bookmarks",
	// 扩展功能
	"footer",
	"ads",
	"license",
	"analytics",
];
const orderOf = (key: string) => {
	const i = GROUP_ORDER.indexOf(key);
	return i === -1 ? Number.MAX_SAFE_INTEGER : i;
};

// 组内字段显示顺序（按功能逻辑聚簇）：仅列出需重排的组，未列出的组沿用源文件顺序。
// 与 GROUP_ORDER 同为“展现层单一来源”，不改变各字段功能/存储键。
export const FIELD_ORDER: Record<string, string[]> = {
	// 站点身份 → 主题外观 → 页面开关
	basic: [
		"title",
		"subtitle",
		"description",
		"keywords",
		"siteUrl",
		"siteStartDate",
		"timezone",
		"faviconUrl",
		"hue",
		"defaultMode",
		"pageWidth",
		"categoryBar",
		"categoryStyle",
		"tagStyle",
		"cardBorder",
		"cardFollowTheme",
		"cardRadius",
		"pageFriends",
		"pageGuestbook",
		"pageDynamic",
		"pageGallery",
		"pageBooknav",
		"pageBilibili",
		"pageBangumi",
		"pageVndb",
		"pageMal",
		"pageSponsor",
	],
	// 模式 → 图源 → 遵罩/叠加 → 主页文字 → 打字机 → 轮播 → 背景视频
	theme: [
		"mode",
		"bannerUrl",
		"mobileImages",
		"dimOpacity",
		"overlayOpacity",
		"overlayBlur",
		"overlayCardOpacity",
		"homeTextEnable",
		"homeTitle",
		"homeTitleSize",
		"homeSubtitles",
		"homeSubtitleSize",
		"typewriter",
		"typewriterSpeed",
		"typewriterDeleteSpeed",
		"typewriterPauseTime",
		"carousel",
		"carouselInterval",
		"carouselTransition",
		"playerEnable",
		"playerMode",
		"playerUrl",
	],
	// 总开关 → 主题色 → 布局 → 卡片 → 壁纸 → 叠加 → 特效 → 横幅
	panel: [
		"enable",
		"themeColorSwitchable",
		"layoutSwitchable",
		"cardBorderSwitchable",
		"cardFollowThemeSwitchable",
		"wallpaperModeSwitchable",
		"overlayOpacitySwitchable",
		"overlayBlurSwitchable",
		"overlayCardOpacitySwitchable",
		"wavesSwitchable",
		"gradientSwitchable",
		"sakuraSwitchable",
		"bannerTitleSwitchable",
		"bannerCarouselSwitchable",
	],
	// 樱花（开关→数量→越界上限）→ 波浪 → 渐变 → 横幅轮播
	effects: [
		"sakura",
		"sakuraNum",
		"limitTimes",
		"waves",
		"gradient",
		"bannerCarousel",
	],
	// 总开关放最前
	font: [
		"enable",
		"scale",
		"bannerTitleFont",
		"bannerSubtitleFont",
		"navbarTitleFont",
		"codeFont",
	],
	// 开关 → 图源 → 可配性 → 展示
	cover: [
		"enable",
		"defaultImage",
		"randomCoverImage",
		"configurable",
		"enableInPost",
		"enableInPostOverlay",
		"showLoading",
	],
	// 与 mermaid/plantuml 一致：浅色在前
	expressiveCode: ["lightTheme", "darkTheme"],
	// 总开关 → 显示入口 → 播放行为 → Meting 源 → 本地源
	music: [
		"enabled",
		"showInNavbar",
		"showInSidebar",
		"mode",
		"autoplay",
		"volume",
		"playMode",
		"showLyrics",
		"metingApi",
		"metingServer",
		"metingType",
		"metingId",
		"metingAuth",
		"metingFallbackApis",
		"sourceScript",
		"localPlaylist",
	],
	// 开关 → 文案 → 二维码 → 列表/按钮
	sponsor: [
		"enabled",
		"title",
		"description",
		"usage",
		"qrCode",
		"sponsors",
		"showSponsorsList",
		"showButtonInPost",
	],
	bookmarks: ["title", "description", "favicon", "groups"],
	footer: ["enable", "text", "startYear", "icp", "customHtml"],
	license: ["enabled", "name", "type", "url", "icon"],
};

function withFieldOrder(group: Group): Group {
	const order = FIELD_ORDER[group.key];
	if (!order) return group;
	const idx = (name: string) => {
		const i = order.indexOf(name);
		return i === -1 ? Number.MAX_SAFE_INTEGER : i;
	};
	return {
		...group,
		fields: [...group.fields].sort((a, b) => idx(a.name) - idx(b.name)),
	};
}

export const GROUPS: Group[] = [
	...siteGroups,
	...featureGroups,
	...pageGroups,
	...extensionGroups,
]
	.sort((a, b) => orderOf(a.key) - orderOf(b.key))
	.map(withFieldOrder);

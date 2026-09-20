import { fontsList } from "@shared/config/fontConfig";
import type { SelectOption } from "./types";

const FONT_OPTIONS: SelectOption[] = [
	{ label: "默认（继承正文字体）", value: "" },
	...fontsList.map((f) => ({ label: f.name, value: f.cssVariable })),
];

import type { Field, Group } from "./types";

export const featureGroups: Group[] = [
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
];

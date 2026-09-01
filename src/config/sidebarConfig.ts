import type { SidebarLayoutConfig } from "../types/sidebarConfig";

export const sidebarLayoutConfig: SidebarLayoutConfig = {
	// 是否启用侧边栏功能
	enable: true,

	position: "both",

	tabletSidebar: "left",

	// 文章详情页隐藏侧边栏，设为 true 则只在首页等非文章页显示
	hideSidebarOnPostPage: false,

	showBothSidebarsOnPostPage: true,

	leftComponents: [
		{
			// 用户资料组件
			type: "profile",
			enable: true,
			position: "top",
			showOnPostPage: true,
		},
		{
			// 公告组件
			type: "announcement",
			enable: true,
			position: "top",
			showOnPostPage: true,
		},
		{
			// 音乐播放器
			type: "music",
			enable: true,
			position: "sticky",
			showOnPostPage: true,
		},
		{
			// 分类组件
			type: "categories",
			enable: true,
			position: "sticky",
			showOnPostPage: true,
			specificConfig: {
				// 折叠阈值：当分类数量超过>5个时自动折叠
				collapseThreshold: 5,
			},
		},
		{
			// 标签组件
			type: "tags",
			enable: true,
			position: "sticky",
			showOnPostPage: true,
			specificConfig: {
				// 折叠阈值：当标签数量超过>10个时自动折叠
				collapseThreshold: 10,
			},
		},
	],

	// 右侧边栏组件配置列表
	rightComponents: [
		{
			// 最新动态组件
			type: "dynamic",
			enable: true,
			position: "top",
			showOnPostPage: true,
			specificConfig: {
				dynamic: {
					// 显示的最新动态数量
					limit: 2,
				},
			},
		},
		{
			// 站点统计组件
			type: "stats",
			enable: true,
			position: "top",
			showOnPostPage: false,
		},
		{
			// 站点信息组件
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
			// 日历组件
			type: "calendar",
			enable: true,
			showTitle: false,
			position: "sticky",
			showOnPostPage: false,
			specificConfig: {
				calendar: {
					// 是否显示年度文章热力图
					showHeatmap: true,
				},
			},
		},
		{
			// 侧边栏目录组件（只在文章详情页显示）
			type: "sidebarToc",
			enable: true,
			position: "sticky",
			showOnPostPage: true,
			hideOnNonPostPage: true,
		},
		{
			// 广告栏组件 1
			type: "advertisement",
			enable: false,
			showTitle: false,
			position: "sticky",
			showOnPostPage: true,
			// 广告内容直接在此配置
			specificConfig: {
				ad: {
					image: {
						src: "/assets/images/ad/ad1.webp",
						alt: "广告横幅",
						link: "https://haoka.lot-ml.com/plugreg.html?agentid=1423316",
						external: true,
					},
					// 是否允许关闭广告
					closable: false,
					// 显示次数限制，-1为无限制
					displayCount: -1,
					// 组件内边距配置
					padding: {
						all: "1rem",
					},
				},
			},
		},
		{
			// 广告栏组件 2
			type: "advertisement",
			enable: false,
			position: "sticky",
			showOnPostPage: true,
			// 广告内容直接在此配置
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
	],

	mobileBottomComponents: [
		{
			// 公告组件
			type: "announcement",
			enable: true,
			showOnPostPage: true,
		},
		{
			// 分类组件
			type: "categories",
			enable: true,
			showOnPostPage: true,
			specificConfig: {
				// 折叠阈值：当分类数量超过5个时自动折叠
				collapseThreshold: 5,
			},
		},
		{
			// 标签组件
			type: "tags",
			enable: true,
			showOnPostPage: true,
			specificConfig: {
				// 折叠阈值：当标签数量超过20个时自动折叠
				collapseThreshold: 10,
			},
		},
		{
			// 最新动态组件
			type: "dynamic",
			enable: true,
			showOnPostPage: true,
			specificConfig: {
				dynamic: {
					// 显示的最新动态数量
					limit: 2,
				},
			},
		},
		{
			// 站点统计组件
			type: "stats",
			enable: true,
			showOnPostPage: true,
		},
		{
			// 站点信息组件
			type: "siteInfo",
			enable: true,
			showOnPostPage: true,
			specificConfig: {
				siteInfo: {

					unknownBuildPlatform: "Unknown CI",
				},
			},
		},
	],
};

import type { SidebarLayoutConfig } from "../types/sidebarConfig";

/**
 * 侧边栏布局配置
 */
export const sidebarLayoutConfig: SidebarLayoutConfig = {
	// 是否启用侧边栏功能
	enable: true,

	// 侧边栏位置：
	// left: 仅显示左侧边栏
	// right: 仅显示右侧边栏
	// both: 双侧边栏，1280px以上同时显示左右，769-1279px根据tabletSidebar配置显示其中一侧
	position: "both",

	// 平板端(769-1279px)显示哪侧侧边栏，仅position为both时生效
	// left: 平板端显示左侧边栏
	// right: 平板端显示右侧边栏
	tabletSidebar: "left",

	// 文章详情页隐藏侧边栏，设为 true 则只在首页等非文章页显示
	hideSidebarOnPostPage: false,

	// 文章详情页保持双侧栏
	// 使用单侧栏(position为left或right)时，是否在文章详情页显示双侧边栏，（hideSidebarOnPostPage需要保持false）
	// 当position为left时开启此项，文章详情页将额外显示右侧边栏
	// 当position为right时开启此项，文章详情页将额外显示左侧边栏
	// 适用在只想用单侧栏，但在文章详情页想用对侧栏的目录等组件的场景
	showBothSidebarsOnPostPage: true,

	// 左侧边栏组件配置列表
	// 组件的渲染顺序完全取决于它们在配置数组中出现的顺序，但top的组件会优先于sticky位置的组件渲染
	// type 组件类型
	// enable 是否启用该组件
	// showTitle 是否显示该组件标题，默认true
	// position 组件位置：top固定顶部，sticky粘性定位(会跟随页面滚动)
	// showOnPostPage 是否在文章详情页显示该组件
	// hideOnNonPostPage 是否在非文章详情页隐藏该组件（true=仅文章详情页显示）
	// specificConfig 组件专属配置
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
					// 未能识别的构建平台回退显示文本，可自定义
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

	// 移动端底部组件配置列表
	// 这些组件只在移动端(<768px)显示在页面底部，独立于左右侧边栏配置
	mobileBottomComponents: [
		{
			// 用户资料组件
			type: "profile",
			enable: true,
			showOnPostPage: true,
		},
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
					// 未能识别的构建平台回退显示文本，可自定义
					unknownBuildPlatform: "Unknown CI",
				},
			},
		},
	],
};

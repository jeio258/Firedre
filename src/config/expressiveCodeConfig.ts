import type { ExpressiveCodeConfig } from "../types/expressiveCodeConfig";

export const expressiveCodeConfig: ExpressiveCodeConfig = {
	// 暗色主题（用于暗色模式）
	darkTheme: "one-dark-pro",

	// 亮色主题（用于亮色模式）
	lightTheme: "one-light",

	// 代码块折叠插件配置
	pluginCollapsible: {
		enable: true,          
		lineThreshold: 15,                     
		previewLines: 8,            
		defaultCollapsed: true,            
	},

	// 语言徽章插件配置（在代码块右上角显示语言名称文本）
	pluginLanguageBadge: {
		// 是否启用语言徽章插件
		enable: true,
	},

	// 语言Logo插件配置（在代码块右下角显示语言图标）
	pluginLanguageLogo: {
		// 是否启用语言Logo插件
		enable: false,

		color: "mono",
		// 需要排除的语言列表（这些语言不会显示Logo）
		excludedLangs: [],
	},
};

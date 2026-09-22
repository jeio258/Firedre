import type { Group } from "./types";

export const extensionGroups: Group[] = [
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
];

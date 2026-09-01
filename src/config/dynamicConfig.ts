import type { DynamicConfig } from "@/types/dynamicConfig";

export const dynamicConfig: DynamicConfig = {
	// 页面标题，如果留空则使用 i18n 中的翻译
	title: "",

	// 页面描述文本，如果留空则使用 i18n 中的翻译
	description: "",

	// 动态头像和名称的跳转地址，支持站内路径或完整 URL
	profileUrl: "/about/",

	// 是否为每条动态启用评论，需要先在 commentConfig.ts 启用评论系统
	showComment: true,

	// 每页显示的动态数量
	itemsPerPage: 20,

	apiUrl: "/api/dynamic.json",

	memos: {
		// 是否启用 Memos 数据源
		enable: false,

		// Memos 实例地址
		apiUrl: "https://memos.example.com",

		parent: "users/xiaye",
	},
};

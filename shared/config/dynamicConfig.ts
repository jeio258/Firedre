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

	itemsPerPage: 20,

	apiUrl: "/api/dynamic.json",

	memos: {
		enable: false,

		apiUrl: "https://memos.example.com",

		parent: "users/xiaye",
	},
};

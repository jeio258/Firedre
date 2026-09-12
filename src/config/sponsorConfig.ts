import type { SponsorConfig } from "../types/sponsorConfig";

export const sponsorConfig: SponsorConfig = {
	// 页面标题，如果留空则使用 i18n 中的翻译
	title: "",

	// 页面描述文本，如果留空则使用 i18n 中的翻译
	description: "",

	usage:
		"您的打赏将用于服务器维护、内容创作和功能开发，帮助我持续提供优质内容。",

	showSponsorsList: true,

	// 是否显示评论区，需要先在commentConfig.ts启用评论系统
	showComment: true,

	showButtonInPost: true,

	// 打赏者列表（可选）
	sponsors: [
		// 示例：已实名打赏者
		{
			name: "夏叶",
			avatar:
				"https://weavatar.com/avatar/d252655d40d6874417a720bad0a6c5f77f8f6a1fd2f882f8f338402dc37e4190?s=640",
			amount: "¥50",
			date: "2025-10-01",
		},

		// 示例：匿名打赏者
		{
			name: "匿名用户",
			// avatar: "",
			amount: "¥20",
			date: "2025-10-01",
		},
	],
};

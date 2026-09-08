import type { AnnouncementConfig } from "../types/announcementConfig";

export const announcementConfig: AnnouncementConfig = {
	// 公告标题，留空则走i18n默认标题
	title: "",

	content: "欢迎来到我的博客！这是一则示例公告。",

	closable: true,

	link: {
		enable: true,
		text: "了解更多",
		url: "/about/",
		external: false,
	},
};

// 后台侧栏导航数据与辅助函数（AdminApp/AdminSidebar 共用）
export interface NavItem {
	label: string;
	href: string;
	icon: string;
	sections: string[];
}
export const NAV_GROUPS: {
	title: string;
	items: NavItem[];
	settings?: boolean;
}[] = [
	{
		title: "内容管理",
		items: [
			{
				label: "仪表盘",
				href: "/admin/dashboard/",
				icon: "dashboard",
				sections: ["dashboard"],
			},
			{
				label: "文章管理",
				href: "/admin/posts/",
				icon: "article",
				sections: ["posts", "posts-edit", "new"],
			},
		],
	},
	{
		title: "站点模块",
		items: [
			{
				label: "友链管理",
				href: "/admin/links/",
				icon: "link",
				sections: ["links"],
			},
			{
				label: "链接管理",
				href: "/admin/sitelinks/",
				icon: "sitelink",
				sections: ["sitelinks"],
			},
			{
				label: "公告管理",
				href: "/admin/notice/",
				icon: "notice",
				sections: ["notice"],
			},
			{
				label: "动态管理",
				href: "/admin/dynamics/",
				icon: "dynamics",
				sections: ["dynamics"],
			},
			{
				label: "关于页",
				href: "/admin/about/",
				icon: "about",
				sections: ["about"],
			},
			{
				label: "相册管理",
				href: "/admin/gallery/",
				icon: "gallery",
				sections: ["gallery", "album-edit"],
			},
		],
	},
	{
		title: "系统",
		settings: true,
		items: [
			{
				label: "站点设置",
				href: "/admin/settings/",
				icon: "settings",
				sections: ["settings"],
			},
		],
	},
];
const SECTION_TITLES: Record<string, string> = {
	dashboard: "仪表盘",
	posts: "文章管理",
	"posts-edit": "编辑文章",
	new: "新建文章",
	links: "友链管理",
	sitelinks: "链接管理",
	notice: "公告管理",
	dynamics: "动态管理",
	about: "关于页",
	gallery: "相册管理",
	"album-edit": "编辑相册",
	settings: "站点设置",
};
const SECTION_GROUPS: Record<string, string> = {
	dashboard: "内容管理",
	posts: "内容管理",
	"posts-edit": "内容管理",
	new: "内容管理",
	links: "站点模块",
	sitelinks: "站点模块",
	notice: "站点模块",
	dynamics: "站点模块",
	about: "站点模块",
	gallery: "站点模块",
	"album-edit": "站点模块",
	settings: "系统",
};

const ICONS: Record<string, string> = {
	dashboard:
		'<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
	article:
		'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6"/><path d="M9 17h6"/>',
	link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
	sitelink:
		'<path d="M9 12h6"/><path d="M12 9v6"/><rect x="3" y="5" width="18" height="14" rx="2"/>',
	notice:
		'<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
	dynamics:
		'<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
	about: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
	plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
	logout:
		'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
	gallery:
		'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>',
	settings:
		'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
	menu: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
	close: '<path d="M18 6 6 18M6 6l12 12"/>',
	external:
		'<path d="M14 3h7v7"/><path d="m21 3-9 9"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
	theme: '<path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.6 6.6 0 0 0 9.8 9.8z"/>',
	save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/>',
	chevron: '<path d="M6 9l6 6 6-6"/>',
};
function icon(name: string): string {
	return ICONS[name] || ICONS.settings;
}
export function iconSvg(name: string, cls = ""): string {
	return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="18" height="18" aria-hidden="true">${icon(name)}</svg>`;
}

export function isActive(item: NavItem, section: string): boolean {
	return item.sections.includes(section);
}
export function titleOf(section: string): string {
	return SECTION_TITLES[section] || "后台";
}
export function groupTitleOf(section: string): string {
	return SECTION_GROUPS[section] || "";
}

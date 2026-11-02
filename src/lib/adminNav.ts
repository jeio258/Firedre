// 后台侧栏导航数据与辅助函数（AdminApp/AdminSidebar 共用）
export interface NavItem {
	label: string;
	href: string;
	icon: string;
	sections: string[];
}
export interface NavGroup {
	title: string;
	items: NavItem[];
	settings?: boolean;
}
export const NAV_GROUPS: NavGroup[] = [
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
		title: "用户与权限",
		items: [
			{
				label: "用户管理",
				href: "/admin/users/",
				icon: "users",
				sections: ["users"],
			},
			{
				label: "评论审核",
				href: "/admin/comments/",
				icon: "comments",
				sections: ["comments"],
			},
			{
				label: "权限审批",
				href: "/admin/perms/",
				icon: "shield",
				sections: ["perms"],
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
	users: "用户管理",
	comments: "评论审核",
	perms: "权限审批",
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
	users: "用户与权限",
	comments: "用户与权限",
	perms: "用户与权限",
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
	users:
		'<path d="M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3z"/><path d="M8 11c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3z"/><path d="M8 13c-2.33 0-7 1.17-7 3.5V19h14v-2.5C15 14.17 10.33 13 8 13z"/><path d="M16 13c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>',
	comments:
		'<path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"/>',
	shield:
		'<path d="M12 1 3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>',
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

export interface NavAccess {
	isAdmin: boolean;
	perms: readonly string[];
}

/** 权限点 → 可见板块；未登记的权限点不开放任何板块（管理员另走全量）
 *  仪表盘与站点设置只读管理端统计/配置，未授予任何权限点，故不在映射内 */
const PERM_SECTIONS: Record<string, string[]> = {
	"post:create": ["posts", "posts-edit", "new"],
};

/** 按身份裁剪侧栏：非管理员只保留已授予权限点覆盖的板块，空分组整组丢弃 */
export function navGroupsFor(access: NavAccess): NavGroup[] {
	if (access.isAdmin) return NAV_GROUPS;
	const allowed = new Set<string>();
	for (const perm of access.perms) {
		for (const section of PERM_SECTIONS[perm] ?? []) allowed.add(section);
	}
	const groups: NavGroup[] = [];
	for (const group of NAV_GROUPS) {
		const items = group.items.filter((item) =>
			item.sections.some((section) => allowed.has(section)),
		);
		if (items.length > 0) groups.push({ ...group, items });
	}
	return groups;
}

/** 可访问的板块集合（含 href 解析出的 section），用于拦截手输 URL */
export function sectionsOf(groups: NavGroup[]): Set<string> {
	const out = new Set<string>();
	for (const group of groups) {
		for (const item of group.items) {
			for (const section of item.sections) out.add(section);
		}
	}
	return out;
}

export function titleOf(section: string): string {
	return SECTION_TITLES[section] || "后台";
}
export function groupTitleOf(section: string): string {
	return SECTION_GROUPS[section] || "";
}

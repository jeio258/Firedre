export type NavBarLink = {
	name: string;
	url: string;
	external?: boolean;
	icon?: string;
	children?: NavBarLink[];
	pageKey?: string;
};

export type NavbarMode = "static" | "fixed" | "dynamic";

export type NavBarConfig = {
	links: NavBarLink[];
	enabled?: boolean;
	title?: string;
	widthFull?: boolean;
	menuAlign?: string;
	followTheme?: boolean;
	// 导航栏模式：static（不固定，随页面滚动消失）/ fixed（固定在顶部常显）/ dynamic（固定在顶部，下滑隐藏、轻微上滑显示）
	navbarMode?: NavbarMode;
	/** @deprecated 由 navbarMode 取代；true→fixed，false→static */
	stickyNavbar?: boolean;
	logo?: unknown;
};

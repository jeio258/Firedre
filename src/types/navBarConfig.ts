export type NavBarLink = {
	name: string;
	url: string;
	external?: boolean;
	icon?: string;         
	children?: NavBarLink[];         
	pageKey?: string;
};

export type NavBarConfig = {
	links: NavBarLink[];
};

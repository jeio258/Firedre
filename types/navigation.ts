export interface NavDrawVideo {
	url: string;
	/** 抽取权重，数值越大出现概率越高 */
	weight: number;
}

export interface NavSiteItem {
	name: string;
	url: string;
	desc?: string;
	avatar?: string;
	color?: string;
	siteshot?: string;
}

export interface NavSiteGroup {
	name?: string;
	desc?: string;
	sites: NavSiteItem[];
}

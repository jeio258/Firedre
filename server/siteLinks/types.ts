export type SiteLinkLocation = "navbar" | "footer" | "profile" | "sponsor";

/** 链接类型：link=普通跳转外链/内链；qr=二维码图片（打赏收款码） */
export type SiteLinkKind = "link" | "qr";

export interface SiteLinkInput {
	name?: string;
	url?: string;
	icon?: string;
	location?: SiteLinkLocation;
	kind?: SiteLinkKind;
	sortOrder?: number;
	enabled?: boolean;
}

export interface SiteLinkRecord {
	id: number;
	name: string;
	url: string;
	icon: string;
	location: string;
	kind: string;
	sort_order: number;
	enabled: number;
	updated_at: string;
}

/** 前台展示用的扁平链接（已过滤停用项、按 sort_order 排序） */
export interface SiteLinkView {
	id: number;
	name: string;
	url: string;
	icon: string;
	location: SiteLinkLocation;
	kind: SiteLinkKind;
	sortOrder: number;
	enabled: boolean;
}

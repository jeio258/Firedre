export type SiteLinkLocation = "navbar" | "footer" | "profile" | "sponsor";

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

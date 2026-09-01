export interface DynamicItem {
	id: string;
	content: string;
	html?: string;
	published: number;
	pinned?: boolean;
	location?: string;
	images?: Array<{ alt: string; src: string; title?: string }>;
	searchText?: string;
}

export interface DynamicRecord {
	id: string;
	content: string;
	images: string;
	published: number;
	pinned: number;
	location: string;
	search_text: string;
	created_at: string;
	updated_at: string;
}

export interface PostFrontmatter {
	title: string;

	published?: string;
	date?: string;
	updated?: string;
	excerpt?: string;
	description?: string;
	categories?: string | string[];
	category?: string;
	tags?: string[] | string;
	cover?: string;
	image?: string;
	top?: number | boolean;
	pin_order?: number;
	pinned?: boolean;
	hidden?: boolean;
	draft?: boolean;

	password?: string;
	passwordHint?: string;
	series?: string;
	seriesOrder?: number;
	lang?: string;
	author?: string;
	sourceLink?: string;
	licenseName?: string;
	licenseUrl?: string;
	comment?: boolean;
	[key: string]: unknown;
}

export interface PostRecord {
	slug: string;
	title: string;
	excerpt: string | null;
	description: string | null;
	date: string;
	updated: string | null;
	categories: string | null;
	tags: string | null;
	cover: string | null;
	pin_order?: number;
	published: number;
	password: string;
	fm_json: string;
	words: number;
	minutes: number;
	r2_key: string;
	created_at: string;
	updated_at: string;
}

export interface PostListItem {
	slug: string;
	title: string;
	excerpt?: string;
	description?: string;
	date: string;
	updated?: string;
	categories?: string[];
	tags?: string[];
	cover?: string;
	path: string;

	published: number;
	top?: number | boolean;
	pin_order?: number;
	pinned?: boolean;
	hidden?: boolean;
	draft?: boolean;

	password?: string;

	frontmatter?: Record<string, unknown>;
}

export interface PostDetail extends PostListItem {
	html: string;
	headings: MarkdownHeading[];
	words: number;
	minutes: number;
	frontmatter: PostFrontmatter;

	source?: string;

	markdown?: string;
}

export interface MarkdownHeading {
	depth: number;
	slug: string;
	text: string;
}

export interface PostsListResponse {
	posts: PostListItem[];
	total: number;
	page: number;
	pageSize: number;
}

export interface CategoryTreeNode {
	name: string;
	total: number;
	children: CategoryTreeNode[];
}

export interface TagCountItem {
	name: string;
	count: number;
}

export interface ArchiveMonthItem {
	month: string;
	count: number;
}

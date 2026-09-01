export interface PostFrontmatter {
	title: string;
	/** Firefly 风格发布时间（YYYY-MM-DD） */
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
	/** Firefly 附加字段 */
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
	/** D1 published 列（1=已发布，0=草稿），后台文章管理据此显示状态 */
	published: number;
	top?: number | boolean;
	pin_order?: number;
	pinned?: boolean;
	hidden?: boolean;
	draft?: boolean;
	/** 加密文章标记（非空即加密） */
	password?: string;
	/** 完整 frontmatter（含 series/author/comment 等 Firefly 字段） */
	frontmatter?: Record<string, unknown>;
}

export interface PostDetail extends PostListItem {
	html: string;
	headings: MarkdownHeading[];
	words: number;
	minutes: number;
	frontmatter: PostFrontmatter;
	/** 完整 Markdown 源码（仅管理员 GET 时返回） */
	source?: string;
	/** Markdown 正文（不含 frontmatter，仅管理员 GET 时返回） */
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

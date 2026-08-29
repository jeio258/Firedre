/**
 * Firedre 前端文章数据模型
 *
 * 保持与 Firefly 组件期望的 CollectionEntry<"posts"> 形状兼容（id + data），
 * 以便 PostCard / PostPage / PostMeta / License / SeriesNav 等组件无需改动。
 */

export interface PostFrontmatterLike {
	title: string;
	published: Date;
	updated?: Date;
	draft: boolean;
	description: string;
	image: string;
	tags: string[];
	category: string | null;
	lang: string;
	pinned: boolean;
	author: string;
	sourceLink: string;
	licenseName: string;
	licenseUrl: string;
	comment: boolean;
	password: string;
	passwordHint: string;
	series: string;
	seriesOrder?: number;
	prevTitle: string;
	prevSlug: string;
	nextTitle: string;
	nextSlug: string;
	[key: string]: unknown;
}

export interface PostForList {
	id: string;
	data: PostFrontmatterLike;
}

/** API 列表项（server/posts/service 返回） */
export interface ApiPostListItem {
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
	pin_order?: number;
	pinned?: boolean;
	password?: string;
	frontmatter?: Record<string, unknown>;
}

/** API 文章详情 */
export interface ApiPostDetail extends ApiPostListItem {
	html: string;
	headings: Array<{ depth: number; slug: string; text: string }>;
	words: number;
	minutes: number;
	frontmatter: Record<string, unknown>;
	source?: string;
	markdown?: string;
}

function str(value: unknown): string {
	return value == null ? "" : String(value);
}

function bool(value: unknown, fallback: boolean): boolean {
	if (value === undefined || value === null) return fallback;
	if (typeof value === "boolean") return value;
	return String(value) === "true";
}

function num(value: unknown): number | undefined {
	if (value === undefined || value === null || value === "") return undefined;
	const n = Number(value);
	return Number.isFinite(n) ? n : undefined;
}

function dateValue(value: unknown): Date {
	if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
	const strVal = str(value);
	if (!strVal) return new Date(0);
	// 兼容 YYYY-MM-DD 与 ISO
	const d = new Date(strVal.length === 10 ? `${strVal}T00:00:00` : strVal);
	return Number.isNaN(d.getTime()) ? new Date(0) : d;
}

/** API 列表项 → Firefly 兼容的 PostForList */
export function apiPostToPostForList(item: ApiPostListItem): PostForList {
	const fm = item.frontmatter ?? {};
	const category = str(fm.category) || item.categories?.[0] || "";
	const series = str(fm.series);
	return {
		id: item.slug,
		data: {
			title: item.title || str(fm.title),
			published: dateValue(fm.published ?? item.date),
			updated:
				fm.updated || item.updated
					? dateValue(fm.updated ?? item.updated)
					: undefined,
			draft: bool(fm.draft, false),
			description: item.description ?? item.excerpt ?? str(fm.description),
			image: item.cover ?? str(fm.image),
			tags: item.tags ?? (Array.isArray(fm.tags) ? fm.tags.map(String) : []),
			category: category || null,
			lang: str(fm.lang),
			pinned: bool(fm.pinned, (item.pin_order ?? 0) > 0),
			author: str(fm.author),
			sourceLink: str(fm.sourceLink),
			licenseName: str(fm.licenseName),
			licenseUrl: str(fm.licenseUrl),
			comment: bool(fm.comment, true),
			password: str(fm.password ?? item.password),
			passwordHint: str(fm.passwordHint),
			series,
			seriesOrder: num(fm.seriesOrder),
			prevTitle: "",
			prevSlug: "",
			nextTitle: "",
			nextSlug: "",
		},
	};
}

/** API 详情 → 兼容 entry 的对象（含正文 html 与元数据） */
export function apiPostToEntry(post: ApiPostDetail): {
	entry: PostForList;
	html: string;
	headings: Array<{ depth: number; slug: string; text: string }>;
	words: number;
	minutes: number;
	excerpt: string;
} {
	const entry = apiPostToPostForList(post);
	// 详情中的 frontmatter 更完整，覆盖列表映射
	if (post.frontmatter) {
		const fm = post.frontmatter;
		entry.data.series = str(fm.series);
		entry.data.seriesOrder = num(fm.seriesOrder);
		entry.data.author = str(fm.author);
		entry.data.sourceLink = str(fm.sourceLink);
		entry.data.licenseName = str(fm.licenseName);
		entry.data.licenseUrl = str(fm.licenseUrl);
		entry.data.comment = bool(fm.comment, true);
		entry.data.lang = str(fm.lang);
		entry.data.password = str(fm.password ?? post.password);
		entry.data.passwordHint = str(fm.passwordHint);
		entry.data.category =
			str(fm.category) || post.categories?.[0] || entry.data.category;
	}
	return {
		entry,
		html: post.html,
		headings: post.headings,
		words: post.words,
		minutes: post.minutes,
		excerpt: post.excerpt ?? post.description ?? "",
	};
}

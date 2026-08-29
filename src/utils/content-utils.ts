/**
 * Content Utilities（Firedre 动态版）
 *
 * 全部数据来自 /api/*（D1 + R2），不再依赖 Content Collections。
 * 函数签名与返回形状保持与 Firefly 原版兼容（PostForList / Tag / Category / Series）。
 * SSR 与客户端通用；同页多个组件共享请求（fetchWithDedup）。
 */

import { fetchWithDedup } from "./fetch-dedup";
import {
	type ApiPostDetail,
	type ApiPostListItem,
	apiPostToPostForList,
	type PostForList,
} from "./post-types";
import { getCategoryUrl } from "./url-utils";

export type { ApiPostDetail, ApiPostListItem, PostForList };

const API_BASE = "/api";

export function apiUrl(path: string) {
	const normalized = path.startsWith("/") ? path : `/${path}`;
	return `${API_BASE}${normalized}`;
}

interface PostsListResponse {
	posts: ApiPostListItem[];
	total: number;
	page: number;
	pageSize: number;
}

async function fetchPostsList(
	params: Record<string, string | number> = {},
): Promise<ApiPostListItem[]> {
	const search = new URLSearchParams();
	for (const [key, value] of Object.entries(params)) {
		if (value !== undefined && value !== "") search.set(key, String(value));
	}
	const query = search.toString();
	const url = apiUrl(`/posts/${query ? `?${query}` : ""}`);
	const data = await fetchWithDedup<PostsListResponse>(url);
	return data.posts || [];
}

/** 置顶优先，然后按发布日期降序 */
function sortPosts(posts: ApiPostListItem[]): ApiPostListItem[] {
	return [...posts].sort((a, b) => {
		const pinA = a.pinned || (a.pin_order ?? 0) > 0 ? 1 : 0;
		const pinB = b.pinned || (b.pin_order ?? 0) > 0 ? 1 : 0;
		if (pinA !== pinB) return pinB - pinA;
		return Date.parse(b.date || "") - Date.parse(a.date || "");
	});
}

/** 设置前后文章（按排序结果） */
function setPrevNext(posts: PostForList[]): PostForList[] {
	for (let i = 1; i < posts.length; i++) {
		posts[i].data.prevSlug = posts[i - 1].id;
		posts[i].data.prevTitle = posts[i - 1].data.title;
	}
	for (let i = 0; i < posts.length - 1; i++) {
		posts[i].data.nextSlug = posts[i + 1].id;
		posts[i].data.nextTitle = posts[i + 1].data.title;
	}
	return posts;
}

/**
 * 获取全部文章（含 prev/next），按置顶 + 日期排序。
 */
export async function getSortedPosts(): Promise<PostForList[]> {
	const items = sortPosts(await fetchPostsList({ pageSize: 200 }));
	return setPrevNext(items.map(apiPostToPostForList));
}

/**
 * 获取全部文章（不含 prev/next）。
 */
export async function getSortedPostsList(): Promise<PostForList[]> {
	const items = sortPosts(await fetchPostsList({ pageSize: 200 }));
	return items.map(apiPostToPostForList);
}

export type Tag = {
	name: string;
	count: number;
};

export async function getTagList(): Promise<Tag[]> {
	const data = await fetchWithDedup<{ tags: Tag[] }>(
		apiUrl("/posts/taxonomy/tags/"),
	);
	return data.tags || [];
}

export type Category = {
	name: string;
	count: number;
	url: string;
};

export async function getCategoryList(): Promise<Category[]> {
	const data = await fetchWithDedup<{
		categories: Array<{ name: string; total: number }>;
	}>(apiUrl("/posts/taxonomy/categories/"));
	return (data.categories || []).map((cat) => ({
		name: cat.name,
		count: cat.total,
		url: getCategoryUrl(cat.name),
	}));
}

export type Series = { name: string; count: number; posts: PostForList[] };

/** 系列内排序：seriesOrder 升序 → 日期降序 */
function sortBySeriesOrder(a: PostForList, b: PostForList): number {
	const ao = a.data.seriesOrder;
	const bo = b.data.seriesOrder;
	if (ao !== undefined && bo !== undefined) {
		if (ao !== bo) return ao - bo;
	} else if (ao === undefined && bo !== undefined) {
		return 1;
	} else if (ao !== undefined && bo === undefined) {
		return -1;
	}
	return (
		b.data.published.getTime() - a.data.published.getTime() ||
		a.data.title.localeCompare(b.data.title)
	);
}

export async function getSeriesList(): Promise<Series[]> {
	const allPosts = await getSortedPostsList();
	const groupMap = new Map<string, PostForList[]>();
	for (const post of allPosts) {
		const name = post.data.series.trim();
		if (!name) continue;
		if (!groupMap.has(name)) groupMap.set(name, []);
		groupMap.get(name)?.push(post);
	}
	const seriesList: Series[] = [];
	for (const [name, posts] of groupMap) {
		posts.sort(sortBySeriesOrder);
		seriesList.push({ name, count: posts.length, posts });
	}
	seriesList.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
	return seriesList;
}

export async function getSeriesPosts(
	currentPost: PostForList,
	allPosts?: PostForList[],
): Promise<{
	seriesName: string;
	posts: PostForList[];
	currentIndex: number;
} | null> {
	const seriesName = currentPost.data.series.trim();
	if (!seriesName) return null;
	const posts = (allPosts ?? (await getSortedPostsList())).filter(
		(p) => p.data.series.trim() === seriesName,
	);
	posts.sort(sortBySeriesOrder);
	const currentIndex = posts.findIndex((p) => p.id === currentPost.id);
	return { seriesName, posts, currentIndex };
}

/** 标题分词（Jaccard 相似度用） */
function tokenizeTitle(title: string): Set<string> {
	const tokens = new Set<string>();
	const segmenter = new Intl.Segmenter("zh", { granularity: "word" });
	for (const { segment, isWordLike } of segmenter.segment(title)) {
		if (!isWordLike) continue;
		tokens.add(segment.toLowerCase());
	}
	return tokens;
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
	if (a.size === 0 && b.size === 0) return 0;
	let intersection = 0;
	for (const item of a) {
		if (b.has(item)) intersection++;
	}
	const union = a.size + b.size - intersection;
	return union === 0 ? 0 : intersection / union;
}

/**
 * 相关文章推荐（与 Firefly 原版评分公式一致）
 */
export async function getRelatedPosts(
	currentPost: PostForList,
	maxCount = 5,
): Promise<PostForList[]> {
	const allPosts = (await getSortedPostsList()).filter(
		(p) => p.id !== currentPost.id && !p.data.password,
	);

	const currentTags = new Set(currentPost.data.tags || []);
	const currentTokens = tokenizeTitle(currentPost.data.title);
	const currentCategory = currentPost.data.category || "";
	const now = Date.now();

	const scored = allPosts.map((post) => {
		const postTags = new Set(post.data.tags || []);
		const tagMatchScore = jaccardSimilarity(currentTags, postTags) * 100;
		const postTokens = tokenizeTitle(post.data.title);
		const titleSimilarityScore =
			jaccardSimilarity(currentTokens, postTokens) * 100;
		const daysSincePublished =
			(now - post.data.published.getTime()) / (1000 * 60 * 60 * 24);
		const timeFreshnessScore =
			30 * Math.exp((-Math.LN2 * daysSincePublished) / 180);
		const postCategory = post.data.category || "";
		const categoryBonus =
			currentCategory && postCategory && currentCategory === postCategory
				? 10
				: 0;
		return {
			post,
			totalScore:
				tagMatchScore +
				titleSimilarityScore +
				timeFreshnessScore +
				categoryBonus,
			tagMatchScore,
			timeFreshnessScore,
			categoryBonus,
		};
	});

	scored.sort((a, b) => b.totalScore - a.totalScore);
	const withTagMatch = scored.filter((s) => s.tagMatchScore > 0);
	const withoutTagMatch = scored.filter((s) => s.tagMatchScore === 0);

	const result: PostForList[] = [];
	for (const s of withTagMatch) {
		if (result.length >= maxCount) break;
		result.push(s.post);
	}
	if (result.length < maxCount) {
		withoutTagMatch.sort(
			(a, b) =>
				b.timeFreshnessScore +
				b.categoryBonus -
				(a.timeFreshnessScore + a.categoryBonus),
		);
		for (const s of withoutTagMatch) {
			if (result.length >= maxCount) break;
			result.push(s.post);
		}
	}
	return result;
}

/** 站点统计用（id + 日期 + 描述） */
export async function fetchPostsForStats(): Promise<
	Array<{
		id: string;
		data: { published: Date; updated?: Date; description?: string };
	}>
> {
	const items = await fetchPostsList({ pageSize: 200 });
	return items.map((p) => ({
		id: p.slug,
		data: {
			published: new Date(p.date || 0),
			updated: p.updated ? new Date(p.updated) : undefined,
			description: p.description ?? p.excerpt ?? "",
		},
	}));
}

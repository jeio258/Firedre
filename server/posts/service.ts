import type {
	WikiLinkPostMeta,
	WikiLinkResolver,
} from "../../src/plugins/remark-wiki-link-runtime";
import type { CloudflareEnv } from "../../types/env";
import type {
	PostDetail,
	PostFrontmatter,
	PostListItem,
	PostRecord,
	PostsListResponse,
} from "../../types/posts";
import { normalizePinOrder, sortPostsByPinOrder } from "../../utils/pinOrder";
import { UserError } from "../utils/userError";
import {
	decodePostSlug,
	encodePostPath,
	isPublished,
	mapFrontmatterToRecord,
	normalizeCategories,
	normalizeTags,
	postR2Key,
	serializeFrontmatter,
	splitMarkdown,
} from "./frontmatter";
import { renderMarkdown, stripMarkdown } from "./render";
import {
	categoryFilterSql,
	listArchiveMonths,
	listCategoryTree,
	listTagCounts,
	monthFilterSql,
	syncPostTaxonomy,
	tagFilterSql,
} from "./taxonomy";

// WikiLink 缓存（模块内声明，避免循环导入）
interface WikiLinkMetaCache {
	data: WikiLinkPostMeta[];
	timestamp: number;
}

const wikiMetaCache = new Map<string, WikiLinkMetaCache>();
const WIKI_CACHE_TTL_MS = 5 * 60 * 1000; // 5 分钟

function parseJsonList(raw: string | null): string[] | undefined {
	if (!raw) return undefined;
	try {
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed.map(String) : undefined;
	} catch {
		return undefined;
	}
}

function recordToListItem(row: PostRecord): PostListItem {
	const fm = parseFmJson(row.fm_json);
	const categories =
		parseJsonList(row.categories) ??
		(fm.category ? [String(fm.category)] : undefined);
	const tags =
		parseJsonList(row.tags) ??
		(Array.isArray(fm.tags) ? fm.tags.map(String) : undefined);
	return {
		slug: row.slug,
		title: row.title,
		excerpt: row.excerpt || undefined,
		description: row.description || undefined,
		date: row.date,
		updated: row.updated || undefined,
		categories,
		tags,
		cover: row.cover || undefined,
		path: encodePostPath(row.slug),
		pin_order: row.pin_order ?? 0,
		pinned: (row.pin_order ?? 0) > 0,
		password: row.password || undefined,
		frontmatter: fm,
	};
}

function parseFmJson(raw: string): PostFrontmatter {
	try {
		return JSON.parse(raw) as PostFrontmatter;
	} catch {
		return {} as PostFrontmatter;
	}
}

function sortPosts(posts: PostListItem[]) {
	return sortPostsByPinOrder(posts);
}

export async function listPosts(
	env: CloudflareEnv,
	options: {
		page?: number;
		pageSize?: number;
		category?: string;
		tag?: string;
		month?: string;
		includeUnpublished?: boolean;
	} = {},
): Promise<PostsListResponse> {
	const page = Math.max(1, options.page || 1);
	const pageSize = Math.min(200, Math.max(1, options.pageSize || 100));

	const joins: string[] = [];
	const conditions: string[] = [];
	const binds: unknown[] = [];

	if (!options.includeUnpublished) conditions.push("p.published = 1");

	if (options.category) {
		const filter = categoryFilterSql(options.category);
		joins.push(filter.join);
		conditions.push(filter.where);
		binds.push(...filter.binds);
	}

	if (options.tag) {
		const filter = tagFilterSql(options.tag);
		joins.push(filter.join);
		conditions.push(filter.where);
		binds.push(filter.binds[0]);
	}

	if (options.month) {
		const filter = monthFilterSql(options.month);
		if (filter.join) joins.push(filter.join);
		conditions.push(filter.where);
		binds.push(filter.binds[0]);
	}

	const joinSql = [...new Set(joins)].join("\n");
	const whereSql = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

	const countRow = await env.DB.prepare(`
    SELECT COUNT(DISTINCT p.slug) AS total
    FROM posts p
    ${joinSql}
    ${whereSql}
  `)
		.bind(...binds)
		.first<{ total: number }>();

	const total = countRow?.total || 0;
	const offset = (page - 1) * pageSize;

	const { results } = await env.DB.prepare(`
    SELECT DISTINCT p.*
    FROM posts p
    ${joinSql}
    ${whereSql}
    ORDER BY p.pin_order DESC, p.date DESC
    LIMIT ? OFFSET ?
  `)
		.bind(...binds, pageSize, offset)
		.all<PostRecord>();

	return {
		posts: sortPosts((results || []).map(recordToListItem)),
		total,
		page,
		pageSize,
	};
}

export async function getTaxonomyCategories(env: CloudflareEnv) {
	return listCategoryTree(env);
}

export async function getTaxonomyTags(env: CloudflareEnv) {
	return listTagCounts(env);
}

export async function getTaxonomyArchives(env: CloudflareEnv) {
	return listArchiveMonths(env);
}

export async function getPostNeighbors(env: CloudflareEnv, slug: string) {
	const decoded = decodePostSlug(slug);
	const { results } = await env.DB.prepare(`
    SELECT slug FROM posts WHERE published = 1 ORDER BY pin_order DESC, date DESC
  `).all<{ slug: string }>();

	const slugs = (results || []).map((row) => row.slug);
	const index = slugs.indexOf(decoded);
	if (index === -1) return { prev: null, next: null };

	const prevSlug = index > 0 ? slugs[index - 1] : null;
	const nextSlug = index < slugs.length - 1 ? slugs[index + 1] : null;

	const prevRow = prevSlug
		? await env.DB.prepare("SELECT * FROM posts WHERE slug = ?")
				.bind(prevSlug)
				.first<PostRecord>()
		: null;
	const nextRow = nextSlug
		? await env.DB.prepare("SELECT * FROM posts WHERE slug = ?")
				.bind(nextSlug)
				.first<PostRecord>()
		: null;

	return {
		prev: prevRow ? recordToListItem(prevRow) : null,
		next: nextRow ? recordToListItem(nextRow) : null,
	};
}

/**
 * 构建 wiki-link resolver：从 D1 查询已发布文章元数据。
 * 匹配顺序：slug 精确 → 子目录路径（含 /index 变体）→ 裸文件名（唯一时）。
 */
export function buildWikiLinkResolver(env: CloudflareEnv): WikiLinkResolver {
	const loadMetas = async (): Promise<WikiLinkPostMeta[]> => {
		const now = Date.now();
		const cached = wikiMetaCache.get("posts");

		// 检查缓存是否有效
		if (cached && now - cached.timestamp < WIKI_CACHE_TTL_MS) {
			return cached.data;
		}

		// 查询 D1
		const result = await env.DB.prepare(`
      SELECT slug, title, description, date, categories, tags, cover, password
      FROM posts WHERE published = 1
    `).all<{
			slug: string;
			title: string;
			description: string | null;
			date: string;
			categories: string | null;
			tags: string | null;
			cover: string | null;
			password: string;
		}>();

		const metas = (result.results || []).map((row) => ({
			slug: row.slug,
			title: row.title,
			description: row.description || undefined,
			published: row.date ? String(row.date).slice(0, 10) : undefined,
			category: parseJsonList(row.categories)?.[0],
			tags: parseJsonList(row.tags),
			password: row.password || undefined,
			image: row.cover || undefined,
		}));

		// 更新缓存
		wikiMetaCache.set("posts", { data: metas, timestamp: now });

		return metas;
	};

	return async (contentPath: string) => {
		const metas = await loadMetas();
		const normalized = contentPath
			.replace(/\.(md|mdx|markdown)$/i, "")
			.replace(/^posts\//, "");

		// 1. slug 精确匹配
		const bySlug = metas.find((meta) => meta.slug === normalized);
		if (bySlug) return bySlug;

		// 2. 路径匹配（含 /index 变体）
		const byPath = metas.find(
			(meta) =>
				meta.slug === normalized ||
				meta.slug === `${normalized}/index` ||
				meta.slug === normalized.replace(/\/index$/, ""),
		);
		if (byPath) return byPath;

		// 3. 裸文件名（唯一时）
		if (!normalized.includes("/")) {
			const matches = metas.filter(
				(meta) => meta.slug.split("/").at(-1) === normalized,
			);
			if (matches.length === 1) return matches[0];
		}

		return null;
	};
}

/**
 * 清除 WikiLink 缓存（在文章更新/删除时调用）
 */
export function clearWikiLinkCache(): void {
	wikiMetaCache.delete("posts");
}

export async function getPostBySlug(
	env: CloudflareEnv,
	slug: string,
	options: { includeUnpublished?: boolean; includeSource?: boolean } = {},
): Promise<PostDetail | null> {
	const decoded = decodePostSlug(slug);
	const row = await env.DB.prepare("SELECT * FROM posts WHERE slug = ?")
		.bind(decoded)
		.first<PostRecord>();
	if (!row) return null;
	if (!options.includeUnpublished && row.published !== 1) return null;

	const object = await env.BUCKET.get(row.r2_key);
	if (!object) return null;

	const source = await object.text();
	const { frontmatter, content } = splitMarkdown(source);
	const rendered = await renderMarkdown(content, {
		frontmatter,
		resolveWikiLink: buildWikiLinkResolver(env),
	});

	const listItem = recordToListItem(row);
	return {
		...listItem,
		html: rendered.html,
		headings: rendered.headings,
		words: rendered.words || row.words || 0,
		minutes: rendered.minutes || row.minutes || 0,
		frontmatter: {
			...frontmatter,
			...(rendered.frontmatter as PostFrontmatter),
		},
		description: row.description || row.excerpt || undefined,
		...(options.includeSource ? { source, markdown: content } : {}),
	};
}

export async function searchPosts(
	env: CloudflareEnv,
	keyword: string,
	limit = 20,
): Promise<PostListItem[]> {
	const q = keyword.trim();
	if (!q) return [];

	const { results } = await env.DB.prepare(`
    SELECT p.* FROM posts_fts f
    JOIN posts p ON p.slug = f.slug
    WHERE posts_fts MATCH ? AND p.published = 1
    ORDER BY rank
    LIMIT ?
  `)
		.bind(q, limit)
		.all<PostRecord>();

	return sortPosts((results || []).map(recordToListItem));
}

export async function upsertPost(
	env: CloudflareEnv,
	slug: string,
	source: string,
) {
	const decoded = decodePostSlug(slug);
	const { frontmatter, content } = splitMarkdown(source);
	if (!frontmatter.title || !(frontmatter.published || frontmatter.date))
		throw new UserError("文章 frontmatter 必须包含 title 与 published(date)");

	const mapped = mapFrontmatterToRecord(frontmatter);
	const published = isPublished(frontmatter) ? 1 : 0;
	const r2Key = postR2Key(decoded);
	const categories =
		normalizeCategories(frontmatter.categories) ??
		(frontmatter.category ? [String(frontmatter.category)] : []);
	const tags = normalizeTags(frontmatter.tags) ?? [];
	const plain = stripMarkdown(content);
	const pinOrder = normalizePinOrder(
		frontmatter.pin_order ?? (frontmatter.pinned ? 1 : frontmatter.top),
	);

	// 渲染一次以获取 words/minutes/headings（尽力而为，失败不阻断保存）
	let words = 0;
	let minutes = 0;
	let headingsJson = "[]";
	try {
		const rendered = await renderMarkdown(content, {
			frontmatter,
			resolveWikiLink: buildWikiLinkResolver(env),
		});
		words = rendered.words;
		minutes = rendered.minutes;
		headingsJson = JSON.stringify(rendered.headings);
	} catch {
		// 渲染失败不阻断保存
	}

	await env.BUCKET.put(r2Key, source, {
		httpMetadata: { contentType: "text/markdown; charset=utf-8" },
	});

	await env.DB.prepare(`
    INSERT INTO posts (
      slug, title, excerpt, description, date, updated, categories, tags, cover,
      pin_order, published, password, fm_json, words, minutes, headings_json, r2_key, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(slug) DO UPDATE SET
      title = excluded.title,
      excerpt = excluded.excerpt,
      description = excluded.description,
      date = excluded.date,
      updated = excluded.updated,
      categories = excluded.categories,
      tags = excluded.tags,
      cover = excluded.cover,
      pin_order = excluded.pin_order,
      published = excluded.published,
      password = excluded.password,
      fm_json = excluded.fm_json,
      words = excluded.words,
      minutes = excluded.minutes,
      headings_json = excluded.headings_json,
      r2_key = excluded.r2_key,
      updated_at = datetime('now')
  `)
		.bind(
			decoded,
			String(frontmatter.title),
			mapped.excerpt || null,
			mapped.description || null,
			mapped.date,
			mapped.updated || null,
			categories.length ? JSON.stringify(categories) : null,
			tags.length ? JSON.stringify(tags) : null,
			mapped.cover || null,
			pinOrder,
			published,
			mapped.password,
			JSON.stringify(frontmatter),
			words,
			minutes,
			headingsJson,
			r2Key,
		)
		.run();

	await env.DB.prepare("DELETE FROM posts_fts WHERE slug = ?")
		.bind(decoded)
		.run();
	await env.DB.prepare(`
    INSERT INTO posts_fts (slug, title, excerpt, content)
    VALUES (?, ?, ?, ?)
  `)
		.bind(decoded, String(frontmatter.title), mapped.excerpt || "", plain)
		.run();

	await syncPostTaxonomy(env, decoded, frontmatter);

	// 清除 WikiLink 缓存，确保后续请求获取最新数据
	clearWikiLinkCache();

	return { slug: decoded, r2Key };
}

export async function deletePost(env: CloudflareEnv, slug: string) {
	const decoded = decodePostSlug(slug);
	const row = await env.DB.prepare("SELECT r2_key FROM posts WHERE slug = ?")
		.bind(decoded)
		.first<{ r2_key: string }>();
	if (!row) return false;

	await env.BUCKET.delete(row.r2_key);
	await env.DB.prepare("DELETE FROM posts WHERE slug = ?").bind(decoded).run();
	await env.DB.prepare("DELETE FROM posts_fts WHERE slug = ?")
		.bind(decoded)
		.run();

	// 清除 WikiLink 缓存，确保后续请求获取最新数据
	clearWikiLinkCache();

	return true;
}

export function buildPostSource(frontmatter: PostFrontmatter, content: string) {
	return serializeFrontmatter(frontmatter, content);
}

export async function importPostFromFile(
	env: CloudflareEnv,
	slug: string,
	source: string,
) {
	return upsertPost(env, slug, source);
}

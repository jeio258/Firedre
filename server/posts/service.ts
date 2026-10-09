import type { CloudflareEnv } from "../../types/env";
import type {
	PostDetail,
	PostFrontmatter,
	PostListItem,
	PostRecord,
	PostsListResponse,
} from "../../types/posts";
import {
	bumpContentVersion,
	getSettingsVersionCached,
} from "../settings/service";
import { runDbBatch } from "../utils/dbBatch";
import { sha256Hex } from "../utils/hash";
import { parseStringList } from "../utils/json";
import { normalizePinOrder, sortPostsByPinOrder } from "../utils/pinOrder";
import { UserError } from "../utils/userError";
import {
	decodePostSlug,
	encodePostPath,
	isPublished,
	mapFrontmatterToRecord,
	normalizeTags,
	postR2Key,
	resolveCategories,
	splitMarkdown,
} from "./frontmatter";
import { type RenderedMarkdown, renderMarkdown, stripMarkdown } from "./render";
import {
	buildTaxonomyStatements,
	categoryFilterSql,
	listArchiveMonths,
	listCategoryTree,
	listTagCounts,
	monthFilterSql,
	tagFilterSql,
} from "./taxonomy";
import { buildWikiLinkResolver, clearWikiLinkCache } from "./wikiLink";

function recordToListItem(row: PostRecord): PostListItem {
	const fm = parseFmJson(row.fm_json);
	const categories =
		parseStringList(row.categories) ??
		(fm.category ? [String(fm.category)] : undefined);
	const tags =
		parseStringList(row.tags) ??
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
		published: row.published ?? 0,
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

// 列表查询构造：category/tag 走 taxonomy JOIN，month 走 substr(date)。
// 不使用 DISTINCT：taxonomy JOIN 恒为 1:1 —— tag 因主键 (post_slug,type,value) + 固定 value 至多一行；
// category 由 buildTaxonomyStatements 保证每篇恰一行（唯一写入者）。故无需去重，
// 省掉 SQLite 的 `USE TEMP B-TREE FOR DISTINCT`（EXPLAIN QUERY PLAN 实测）。
export function buildListPostsQuery(options: {
	category?: string;
	tag?: string;
	month?: string;
	includeUnpublished?: boolean;
}) {
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
		binds.push(...filter.binds);
	}

	if (options.month) {
		const filter = monthFilterSql(options.month);
		if (filter.join) joins.push(filter.join);
		conditions.push(filter.where);
		binds.push(...filter.binds);
	}

	const joinSql = [...new Set(joins)].join("\n");
	const whereSql = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

	return {
		binds,
		countSql: `
    SELECT COUNT(*) AS total
    FROM posts p
    ${joinSql}
    ${whereSql}
  `,
		listSql: `
    SELECT p.*
    FROM posts p
    ${joinSql}
    ${whereSql}
    ORDER BY p.pin_order DESC, p.date DESC
    LIMIT ? OFFSET ?
  `,
	};
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
	const { binds, countSql, listSql } = buildListPostsQuery(options);

	const countRow = await env.DB.prepare(countSql)
		.bind(...binds)
		.first<{ total: number }>();

	const total = countRow?.total || 0;
	const offset = (page - 1) * pageSize;

	const { results } = await env.DB.prepare(listSql)
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
	// 单条查询取回「前后篇整行」：窗口函数定位相邻 slug，再按 slug JOIN 取整行（1 次 D1）。
	const { results } = await env.DB.prepare(`
    WITH ranked AS (
      SELECT slug,
        LAG(slug) OVER w AS prev_slug,
        LEAD(slug) OVER w AS next_slug
      FROM posts WHERE published = 1
      WINDOW w AS (ORDER BY pin_order DESC, date DESC)
    ),
    target AS (SELECT slug, prev_slug, next_slug FROM ranked WHERE slug = ?)
    SELECT p.*, t.prev_slug, t.next_slug
    FROM target t JOIN posts p ON p.slug IN (t.slug, t.prev_slug, t.next_slug)
  `)
		.bind(decoded)
		.all<PostRecord & { prev_slug: string | null; next_slug: string | null }>();

	const rows = results || [];
	const head = rows[0];
	if (!head) return { prev: null, next: null };

	const bySlug = new Map(rows.map((r) => [r.slug, r]));
	const prevRow = head.prev_slug ? bySlug.get(head.prev_slug) : undefined;
	const nextRow = head.next_slug ? bySlug.get(head.next_slug) : undefined;

	return {
		prev: prevRow ? recordToListItem(prevRow) : null,
		next: nextRow ? recordToListItem(nextRow) : null,
	};
}

// 渲染结果缓存：key = r2_key(内容) + settingsVersion(配置) → 内容或配置变化即失效；
// TTL 60s 兜底直改 D1 场景；无 caches 环境（vitest）直接 miss。
// frontmatter 一并落缓存：命中时可直接组装详情，无需再读 R2
async function getRenderCache(
	cacheKey: string,
): Promise<RenderedMarkdown | null> {
	try {
		if (typeof caches === "undefined") return null;
		const cached = await caches.default.match(cacheKey);
		if (!cached) return null;
		const data = (await cached.json()) as {
			html: string;
			headings: PostDetail["headings"];
			words: number;
			minutes: number;
			excerpt?: string;
			frontmatter: PostFrontmatter;
		};
		return {
			html: data.html,
			headings: data.headings,
			words: data.words,
			minutes: data.minutes,
			excerpt: data.excerpt ?? "",
			frontmatter: data.frontmatter,
		};
	} catch {
		return null;
	}
}

async function setRenderCache(
	cacheKey: string,
	data: {
		html: string;
		headings: PostDetail["headings"];
		words: number;
		minutes: number;
		excerpt?: string;
		frontmatter: PostFrontmatter;
	},
) {
	try {
		if (typeof caches === "undefined") return;
		await caches.default.put(
			cacheKey,
			new Response(JSON.stringify(data), {
				headers: { "Content-Type": "application/json" },
			}),
		);
	} catch {
		// 缓存失败不影响主流程
	}
}

// 渲染缓存键命名空间：**必须为绝对 URL**——workerd 的 Cache API 对相对字符串会抛
// `TypeError: Invalid URL`（match/put 双双抛错，被 catch 吞掉 → 缓存恒 miss，等于白写缓存）。
// `.invalid` 是 RFC 2606 保留 TLD，永不解析，仅作缓存键的占位 origin。
const RENDER_CACHE_BASE = "https://firedre.invalid/__post_render__";

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

	// 渲染缓存：内容(r2_key) + 配置(settingsVersion) 双键，命中跳过整条 Markdown 管线。
	// f=2 为缓存负载结构版本段：结构变更时递增，旧条目键不同即自然失效
	const settingsVersion = await getSettingsVersionCached(env).catch(() => "");
	const renderCacheKey = `${RENDER_CACHE_BASE}/${row.r2_key}?v=${settingsVersion}&f=2`;
	const cachedRender = await getRenderCache(renderCacheKey);

	let rendered: RenderedMarkdown;
	let source: string | undefined;
	let content: string | undefined;

	if (cachedRender && !options.includeSource) {
		// 命中且无需源文 → 直接复用缓存组装，免读 R2
		rendered = cachedRender;
	} else {
		const object = await env.BUCKET.get(row.r2_key);
		if (!object) return null;
		source = await object.text();
		const split = splitMarkdown(source);
		content = split.content;
		if (cachedRender) {
			// 仅缺源文：仍复用缓存渲染结果，避免重渲染
			rendered = cachedRender;
		} else {
			rendered = await renderMarkdown(content, {
				frontmatter: split.frontmatter,
				resolveWikiLink: buildWikiLinkResolver(env),
			});
			await setRenderCache(renderCacheKey, {
				html: rendered.html,
				headings: rendered.headings,
				words: rendered.words,
				minutes: rendered.minutes,
				excerpt: rendered.excerpt,
				frontmatter: rendered.frontmatter as PostFrontmatter,
			});
		}
	}

	const listItem = recordToListItem(row);
	return {
		...listItem,
		html: rendered.html,
		headings: rendered.headings,
		words: rendered.words || row.words || 0,
		minutes: rendered.minutes || row.minutes || 0,
		frontmatter: rendered.frontmatter as PostFrontmatter,
		description: row.description || row.excerpt || undefined,
		...(options.includeSource ? { source, markdown: content } : {}),
	};
}

function escapeFtsKeyword(keyword: string): string {
	return keyword
		.trim()
		.split(/\s+/)
		.filter(Boolean)
		.map((token) => `"${token.replace(/"/g, '""')}"`)
		.join(" AND ");
}

export async function searchPosts(
	env: CloudflareEnv,
	keyword: string,
	limit = 20,
): Promise<PostListItem[]> {
	const q = keyword.trim();
	if (!q) return [];
	const safeQuery = escapeFtsKeyword(q);

	const { results } = await env.DB.prepare(`
    SELECT p.* FROM posts_fts f
    JOIN posts p ON p.slug = f.slug
    WHERE posts_fts MATCH ? AND p.published = 1
    ORDER BY rank
    LIMIT ?
  `)
		.bind(safeQuery, limit)
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
	// 正文哈希驱动版本化 key；内容未变时 hash 相同 → 复用既有对象（零写入）
	const r2Key = postR2Key(decoded, await sha256Hex(source));
	const categories = resolveCategories(frontmatter) ?? [];
	const tags = normalizeTags(frontmatter.tags) ?? [];
	const plain = stripMarkdown(content);
	const pinOrder = normalizePinOrder(
		frontmatter.pin_order ?? (frontmatter.pinned ? 1 : frontmatter.top),
	);

	// 渲染一次以获取 words/minutes（尽力而为，失败不阻断保存）
	let words = 0;
	let minutes = 0;
	try {
		const rendered = await renderMarkdown(content, {
			frontmatter,
			resolveWikiLink: buildWikiLinkResolver(env),
		});
		words = rendered.words;
		minutes = rendered.minutes;
	} catch {
		// 渲染失败不阻断保存
	}

	const postUpsert = env.DB.prepare(`
    INSERT INTO posts (
      slug, title, excerpt, description, date, updated, categories, tags, cover,
      pin_order, published, password, fm_json, words, minutes, r2_key, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
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
      r2_key = excluded.r2_key,
      updated_at = datetime('now')
  `).bind(
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
		r2Key,
	);

	const ftsDelete = env.DB.prepare("DELETE FROM posts_fts WHERE slug = ?").bind(
		decoded,
	);
	const ftsInsert = env.DB.prepare(`
    INSERT INTO posts_fts (slug, title, excerpt, content)
    VALUES (?, ?, ?, ?)
  `).bind(decoded, String(frontmatter.title), mapped.excerpt || "", plain);

	// 正文先写 R2 版本化 key，成功后才跑 D1 批量切换指针：R2 失败时旧指针/旧正文完整保留
	// （D1 批量失败仅残留 R2 孤儿对象，由对账脚本清理）；内容未变时跳过写直接复用旧指针
	const prevRow = await env.DB.prepare(
		"SELECT r2_key FROM posts WHERE slug = ?",
	)
		.bind(decoded)
		.first<{ r2_key: string }>();
	if (prevRow?.r2_key !== r2Key) {
		await env.BUCKET.put(r2Key, source, {
			httpMetadata: { contentType: "text/markdown; charset=utf-8" },
		});
	}

	await runDbBatch(env.DB, [
		postUpsert,
		ftsDelete,
		ftsInsert,
		...buildTaxonomyStatements(env.DB, decoded, frontmatter),
	]);

	// 清除 WikiLink 缓存，确保后续请求获取最新数据
	clearWikiLinkCache();
	await bumpContentVersion(env);

	return { slug: decoded, r2Key };
}

export async function deletePost(env: CloudflareEnv, slug: string) {
	const decoded = decodePostSlug(slug);
	const row = await env.DB.prepare("SELECT r2_key FROM posts WHERE slug = ?")
		.bind(decoded)
		.first<{ r2_key: string }>();
	if (!row) return false;

	// 先删 D1 元数据与索引（单批），成功后清理 R2 正文：失败时仅残留孤儿对象，不影响列表与详情
	await runDbBatch(env.DB, [
		env.DB.prepare("DELETE FROM posts WHERE slug = ?").bind(decoded),
		env.DB.prepare("DELETE FROM posts_fts WHERE slug = ?").bind(decoded),
	]);
	await env.BUCKET.delete(row.r2_key).catch(() => {});

	// 清除 WikiLink 缓存，确保后续请求获取最新数据
	clearWikiLinkCache();
	await bumpContentVersion(env);

	return true;
}

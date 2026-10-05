// 文章 WikiLink 解析器（自 service.ts 拆分，含模块级元数据缓存）。
// 缓存随文章写操作由 clearWikiLinkCache() 失效。
import type {
	WikiLinkPostMeta,
	WikiLinkResolver,
} from "@shared/plugins/remark-wiki-link-runtime";
import type { CloudflareEnv } from "../../types/env";
import { parseStringList } from "../utils/json";

// WikiLink 缓存（模块内声明，避免循环导入）
interface WikiLinkMetaCache {
	data: WikiLinkPostMeta[];
	timestamp: number;
}

const wikiMetaCache = new Map<string, WikiLinkMetaCache>();
const WIKI_CACHE_TTL_MS = 5 * 60 * 1000; // 5 分钟

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
			category: parseStringList(row.categories)?.[0],
			tags: parseStringList(row.tags),
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

export function clearWikiLinkCache(): void {
	wikiMetaCache.delete("posts");
}

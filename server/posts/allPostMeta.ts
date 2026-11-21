// 全量已发布文章元数据（Calendar / 推荐文章共用）。
// 三级：isolate 内存（30s）→ 边缘 Cache API（60s）→ D1。
// 冷启动时 isolate 内存为空，边缘缓存是避免每次新实例都回源 D1 的关键；
// 与 /api/allPostMeta.json 共用同一 slot，避免每页渲染各打一次 D1。
import { edgeCacheGet, edgeCacheSet } from "@server/utils/edgeCache";
import {
	readIsolateCache,
	writeIsolateCache,
} from "@server/utils/isolateCache";
import type { CloudflareEnv } from "../../types/env";

const CACHE_SLOT = "api.allPostMeta";
const CACHE_BASE = "https://firedre-cache.internal/allPostMeta";
const EDGE_TTL = "public, max-age=0, s-maxage=60";

export interface AllPostMetaEntry {
	id: string;
	title: string;
	description: string;
	published: number;
	category: string;
	password: boolean;
}

const edgeKey = (version: string) =>
	`${CACHE_BASE}?v=${encodeURIComponent(version)}&f=1`;

export async function getAllPostMeta(
	env: CloudflareEnv,
	version: string,
): Promise<AllPostMetaEntry[]> {
	const cached = readIsolateCache<AllPostMetaEntry[]>(CACHE_SLOT, version);
	if (cached !== undefined) return cached;

	const edge = await edgeCacheGet<AllPostMetaEntry[]>(edgeKey(version));
	if (edge) {
		writeIsolateCache(CACHE_SLOT, version, edge);
		return edge;
	}

	const { results } = await env.DB.prepare(`
		SELECT slug, title, description, date, categories, password
		FROM posts
		WHERE published = 1
		ORDER BY date DESC
	`).all();

	const data = (results || []).map((row: unknown): AllPostMetaEntry => {
		const r = row as Record<string, unknown>;
		let category = "";
		try {
			const cats = JSON.parse((r.categories as string) || "[]");
			category = Array.isArray(cats) && cats.length ? String(cats[0]) : "";
		} catch {}
		return {
			id: r.slug as string,
			title: r.title as string,
			description: (r.description as string) || "",
			published: new Date(r.date as string).getTime(),
			category,
			password: Boolean(r.password),
		};
	});

	writeIsolateCache(CACHE_SLOT, version, data);
	await edgeCacheSet(edgeKey(version), data, EDGE_TTL);
	return data;
}

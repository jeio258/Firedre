// 全量已发布文章元数据（Calendar / 推荐文章共用）：
// isolate 版本缓存（设置/内容变更即失效，TTL 兜底）→ 命中即返回，miss 才查 D1。
// 与 /api/allPostMeta.json 共用同一缓存 slot，避免每页渲染各打一次 D1。
import {
	readIsolateCache,
	writeIsolateCache,
} from "@server/utils/isolateCache";
import type { CloudflareEnv } from "../../types/env";

const CACHE_SLOT = "api.allPostMeta";

export interface AllPostMetaEntry {
	id: string;
	title: string;
	description: string;
	published: number;
	category: string;
	password: boolean;
}

export async function getAllPostMeta(
	env: CloudflareEnv,
	version: string,
): Promise<AllPostMetaEntry[]> {
	const cached = readIsolateCache<AllPostMetaEntry[]>(CACHE_SLOT, version);
	if (cached !== undefined) return cached;

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
	return data;
}

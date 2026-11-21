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

const CACHE_BASE = "https://firedre-cache.internal/allPostMeta";

// 跨 isolate 共享层：isolate 内存在冷启动后为空，每次冷启都要回 D1（实测首字节 2.4s 的主因之一）。
// 命中边缘缓存可让新 isolate 直接拿到结果，TTL 60s 与渲染缓存保持同一失效口径。
async function readEdgeCache(
	version: string,
): Promise<AllPostMetaEntry[] | null> {
	if (typeof caches === "undefined") return null;
	try {
		const key = `${CACHE_BASE}?v=${encodeURIComponent(version)}&f=1`;
		const hit = await caches.default.match(key);
		if (!hit) return null;
		return (await hit.json()) as AllPostMetaEntry[];
	} catch {
		return null;
	}
}

async function writeEdgeCache(
	version: string,
	data: AllPostMetaEntry[],
): Promise<void> {
	if (typeof caches === "undefined") return;
	try {
		const key = `${CACHE_BASE}?v=${encodeURIComponent(version)}&f=1`;
		await caches.default.put(
			key,
			new Response(JSON.stringify(data), {
				headers: {
					"Content-Type": "application/json",
					// Cache API 无 Cache-Control 头不入缓存
					"Cache-Control": "public, max-age=0, s-maxage=60",
				},
			}),
		);
	} catch {}
}

export async function getAllPostMeta(
	env: CloudflareEnv,
	version: string,
): Promise<AllPostMetaEntry[]> {
	const cached = readIsolateCache<AllPostMetaEntry[]>(CACHE_SLOT, version);
	if (cached !== undefined) return cached;

	const edge = await readEdgeCache(version);
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
	await writeEdgeCache(version, data);
	return data;
}

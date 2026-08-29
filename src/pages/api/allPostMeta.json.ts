import type { APIRoute } from "astro";
import { cfEnv } from "../../lib/api";

export const prerender = false;

/**
 * 日历组件数据：所有已发布文章元数据（按日期降序，忽略置顶）
 * 响应结构保持与 Firefly 原版 /api/allPostMeta.json 一致
 */
export const GET: APIRoute = async () => {
	const { results } = await cfEnv.DB.prepare(`
		SELECT slug, title, description, date, categories, password
		FROM posts
		WHERE published = 1
		ORDER BY date DESC
	`).all();

	const data = (results || []).map((row: any) => ({
		id: row.slug,
		title: row.title,
		description: row.description || "",
		published: new Date(row.date).getTime(),
		category: (() => {
			try {
				const cats = JSON.parse(row.categories || "[]");
				return Array.isArray(cats) && cats.length ? String(cats[0]) : "";
			} catch {
				return "";
			}
		})(),
		password: Boolean(row.password),
	}));

	return new Response(JSON.stringify(data), {
		headers: {
			"Content-Type": "application/json; charset=utf-8",
			"Cache-Control": "public, max-age=60, stale-while-revalidate=300",
		},
	});
};

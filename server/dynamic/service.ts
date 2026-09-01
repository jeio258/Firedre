import type { DynamicItem, DynamicRecord } from "../../types/dynamic";
import type { CloudflareEnv } from "../../types/env";
import { renderMarkdown } from "../posts/render";
import { dynamicSearchText, extractDynamicImages } from "./plain";

function recordToItem(
	row: DynamicRecord,
	html: string,
	images: Array<{ alt: string; src: string; title?: string }>,
	searchText: string,
): DynamicItem {
	return {
		id: row.id,
		content: row.content,
		html,
		published: Number(row.published),
		pinned: row.pinned === 1,
		location: row.location || "",
		images,
		searchText,
	};
}

export async function renderDynamicItem(
	row: DynamicRecord,
): Promise<DynamicItem> {
	const markdown = row.content || "";
	const images = extractDynamicImages(markdown);
	// 渲染时移除图片语法，图片由客户端展示
	const html = await renderMarkdown(
		markdown.replace(/!\[([^\]]*)\]\((\S+?)(?:\s+["'][^"']*["'])?\)/g, ""),
	).then((r) => r.html);
	const searchText = dynamicSearchText(markdown, row.location);
	return recordToItem(row, html, images, searchText);
}

export async function listDynamics(
	env: CloudflareEnv,
	options: { page?: number; pageSize?: number } = {},
): Promise<{
	items: DynamicItem[];
	total: number;
	page: number;
	pageSize: number;
}> {
	const page = Math.max(1, options.page || 1);
	const pageSize = Math.min(200, Math.max(1, options.pageSize || 100));

	const countRow = await env.DB.prepare(
		"SELECT COUNT(*) AS total FROM dynamics",
	).first<{ total: number }>();
	const total = countRow?.total || 0;
	const offset = (page - 1) * pageSize;

	const { results } = await env.DB.prepare(`
    SELECT * FROM dynamics
    ORDER BY pinned DESC, published DESC
    LIMIT ? OFFSET ?
  `)
		.bind(pageSize, offset)
		.all<DynamicRecord>();

	const items = await Promise.all((results || []).map(renderDynamicItem));

	return { items, total, page, pageSize };
}

export async function getAllDynamics(
	env: CloudflareEnv,
): Promise<DynamicItem[]> {
	const { results } = await env.DB.prepare(`
    SELECT * FROM dynamics ORDER BY pinned DESC, published DESC
  `).all<DynamicRecord>();
	return Promise.all((results || []).map(renderDynamicItem));
}

export async function upsertDynamic(
	env: CloudflareEnv,
	id: string,
	payload: {
		content: string;
		published?: number;
		pinned?: boolean;
		location?: string;
	},
) {
	const published = payload.published ?? Date.now();
	const pinned = payload.pinned ? 1 : 0;
	const location = String(payload.location || "");
	const searchText = dynamicSearchText(payload.content, location);

	await env.DB.prepare(`
    INSERT INTO dynamics (id, content, images, published, pinned, location, search_text, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      content = excluded.content,
      images = excluded.images,
      published = excluded.published,
      pinned = excluded.pinned,
      location = excluded.location,
      search_text = excluded.search_text,
      updated_at = datetime('now')
  `)
		.bind(
			id,
			payload.content,
			JSON.stringify(extractDynamicImages(payload.content)),
			published,
			pinned,
			location,
			searchText,
		)
		.run();

	return { id };
}

export async function deleteDynamic(env: CloudflareEnv, id: string) {
	const result = await env.DB.prepare("DELETE FROM dynamics WHERE id = ?")
		.bind(id)
		.run();
	return result.meta.changes > 0;
}

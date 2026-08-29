/**
 * 客户端搜索：调用 D1 FTS5 搜索 API，结果映射为 SearchResult 形状并高亮关键词
 */

import type { SearchResult } from "@/global";

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

/** 将关键词在文本中出现的片段包裹 <mark> */
export function highlightText(text: string, keyword: string): string {
	const escaped = escapeHtml(text);
	const q = keyword.trim();
	if (!q) return escaped;
	const lower = escaped.toLowerCase();
	const qLower = q.toLowerCase();
	if (!lower.includes(qLower)) return escaped;
	const out: string[] = [];
	let cursor = 0;
	let idx = lower.indexOf(qLower);
	while (idx !== -1) {
		out.push(escaped.slice(cursor, idx));
		out.push(`<mark>${escaped.slice(idx, idx + q.length)}</mark>`);
		cursor = idx + q.length;
		idx = lower.indexOf(qLower, cursor);
	}
	out.push(escaped.slice(cursor));
	return out.join("");
}

interface SearchApiItem {
	slug: string;
	title: string;
	path?: string;
	excerpt?: string;
	description?: string;
}

export async function searchPostsApi(keyword: string): Promise<SearchResult[]> {
	const q = keyword.trim();
	if (!q) return [];
	try {
		const resp = await fetch(`/api/posts/search/?q=${encodeURIComponent(q)}`);
		if (!resp.ok) return [];
		const data = (await resp.json()) as { posts?: SearchApiItem[] };
		return (data.posts || []).map((post) => ({
			url: post.path || `/posts/${encodeURIComponent(post.slug)}/`,
			meta: { title: highlightText(post.title, q) },
			excerpt: highlightText(post.excerpt || post.description || "", q),
		}));
	} catch {
		return [];
	}
}

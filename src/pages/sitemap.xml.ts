import type { APIRoute } from "astro";
import { siteConfig } from "../config/index";
import { cfEnv } from "../lib/api";

export const prerender = false;

/**
 * 动态 sitemap：静态页面（按 siteConfig.pages 开关过滤）+ 全部已发布文章 + 相册
 */
export const GET: APIRoute = async () => {
	const base = siteConfig.site_url.replace(/\/+$/, "");
	const urls: string[] = [];

	// 静态页面
	const staticPages: Array<[string, boolean]> = [
		["", true],
		["/about/", true],
		["/archive/", true],
		["/categories/", true],
		["/tags/", true],
		["/series/", true],
		["/search/", true],
		["/friends/", siteConfig.pages.friends],
		["/guestbook/", siteConfig.pages.guestbook],
		["/dynamic/", siteConfig.pages.dynamic],
		["/gallery/", siteConfig.pages.gallery],
		["/booknav/", siteConfig.pages.booknav],
		["/sponsor/", siteConfig.pages.sponsor],
		["/bangumi/", siteConfig.pages.bangumi],
		["/bilibili/", siteConfig.pages.bilibili],
		["/vndb/", siteConfig.pages.vndb],
		["/myanimelist/", siteConfig.pages.mal],
	];
	for (const [path, enabled] of staticPages) {
		if (enabled) urls.push(`${base}${path}`);
	}

	// 文章
	try {
		const stmt = cfEnv.DB.prepare(`
			SELECT slug FROM posts WHERE published = 1 ORDER BY date DESC
		`);
		const { results } = (await stmt.all()) as {
			results?: Array<{ slug: string }>;
		};
		for (const row of results || []) {
			const encoded = row.slug.split("/").map(encodeURIComponent).join("/");
			urls.push(`${base}/posts/${encoded}/`);
		}
	} catch {
		// 数据库不可用时只输出静态页
	}

	const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u}</loc></url>`).join("\n")}
</urlset>`;

	return new Response(body, {
		headers: {
			"Content-Type": "application/xml; charset=utf-8",
			"Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
		},
	});
};

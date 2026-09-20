import { getSiteConfig } from "@shared/config/runtime";
import type { APIRoute } from "astro";

export const prerender = false;

export const GET: APIRoute = async (context) => {
	const cfg = getSiteConfig(context.locals);
	const base = cfg.site_url.replace(/\/+$/, "");
	const body = [
		"User-agent: *",
		"Allow: /",
		"Disallow: /admin/",
		"Disallow: /api/admin/",
		"",
		`Sitemap: ${base}/sitemap.xml`,
		"",
	].join("\n");
	return new Response(body, {
		headers: { "Content-Type": "text/plain; charset=utf-8" },
	});
};

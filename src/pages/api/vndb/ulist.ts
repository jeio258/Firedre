import type { APIRoute } from "astro";
import { json, serverError } from "@/lib/api";
import { proxyCacheGet, proxyCachePut, proxyRateLimited } from "@/lib/proxyCache";
import { siteConfig } from "@/config";
import { fetchVndbUlist } from "@/utils/vndb-utils";

export const prerender = false;

// VNDB 用户列表同源代理：服务端持有 apiToken，token 不落前端
export const GET: APIRoute = async ({ request, url, locals }) => {
	try {
		if (proxyRateLimited(request)) {
			return new Response(JSON.stringify({ error: "请求过于频繁，请稍后再试" }), {
				status: 429,
				headers: { "Content-Type": "application/json" },
			});
		}
		if (!import.meta.env.DEV) {
			const cached = await proxyCacheGet(url);
			if (cached) {
				const headers = new Headers(cached.headers);
				headers.set("X-Firedre-Cache", "HIT");
				return new Response(await cached.text(), { status: cached.status, headers });
			}
		}
		const settings = ((locals as { settings?: Record<string, any> })?.settings ??
			{}) as Record<string, any>;
		const vndbSettings =
			settings?.["vndb"] ?? (siteConfig as any).vndb ?? {};
		const userId =
			(vndbSettings.username as string | undefined) ||
			(vndbSettings.userId as string | undefined) ||
			"";
		const apiToken = (vndbSettings.apiToken as string | undefined) || "";
		const apiUrl =
			(vndbSettings.apiUrl as string | undefined) || "https://api.vndb.org/kana";

		if (!userId.trim() || userId === "you-user-id" || !apiToken.trim()) {
			return json({ error: "VNDB userId / apiToken 未配置" }, 400);
		}

		const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
		const results = Math.max(1, Number(url.searchParams.get("results")) || 100);

		const data = await fetchVndbUlist({
			apiUrl,
			userId,
			apiToken,
			results,
			page,
		});

		const body = json({ results: data.results, more: data.more }, 200, "private");
		await proxyCachePut(url, body.clone());
		return body;
	} catch (error) {
		return serverError(error);
	}
};

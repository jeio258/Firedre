import type { APIRoute } from "astro";
import { json, serverError } from "../../lib/api";
import { proxyCacheGet, proxyCachePut, proxyRateLimited } from "@/lib/proxyCache";
import { siteConfig } from "@/config";
import { fetchBilibiliList } from "@/utils/bilibili-utils";

export const prerender = false;

// Bilibili 追番/追剧列表同源代理：服务端 fetch 第三方并归一化为 StandardizedAnime[]
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
		const uid =
			url.searchParams.get("uid")?.trim() ||
			settings?.["bilibili"]?.uid ||
			(siteConfig as any).bilibili?.uid;
		if (!uid) {
			return json({ error: "bilibili uid 未配置" }, 400);
		}
		const list = await fetchBilibiliList(String(uid));
		const body = json(list, 200, "private");
		await proxyCachePut(url, body.clone());
		return body;
	} catch (error) {
		return serverError(error);
	}
};

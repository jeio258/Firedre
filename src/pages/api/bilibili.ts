import type { APIRoute } from "astro";
import { json, serverError } from "../../lib/api";
import { siteConfig } from "@/config";
import { fetchBilibiliList } from "@/utils/bilibili-utils";

export const prerender = false;

// Bilibili 追番/追剧列表同源代理：服务端 fetch 第三方并归一化为 StandardizedAnime[]
export const GET: APIRoute = async ({ url, locals }) => {
	try {
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
		return json(list, 200, "private");
	} catch (error) {
		return serverError(error);
	}
};

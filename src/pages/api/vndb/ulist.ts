import type { APIRoute } from "astro";
import { json, serverError } from "@/lib/api";
import { siteConfig } from "@/config";
import { fetchVndbUlist } from "@/utils/vndb-utils";

export const prerender = false;

// VNDB 用户列表同源代理：服务端持有 apiToken，token 不落前端
export const GET: APIRoute = async ({ url, locals }) => {
	try {
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

		return json({ results: data.results, more: data.more }, 200, "private");
	} catch (error) {
		return serverError(error);
	}
};

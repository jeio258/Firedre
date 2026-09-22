import type { SettingsView } from "@server/settings/service";
import type { APIRoute } from "astro";
import { siteConfig } from "@/config";
import { withProxyGuard } from "@/lib/proxyCache";
import { fetchBilibiliList } from "@/utils/bilibili-utils";
import { json, serverError } from "../../lib/api";

export const prerender = false;

// Bilibili 追番/追剧列表同源代理：服务端 fetch 第三方并归一化为 StandardizedAnime[]
export const GET: APIRoute = async ({ request, url, locals }) => {
	try {
		return await withProxyGuard(request, url, async () => {
			const settings = (locals as { settings?: SettingsView } | undefined)
				?.settings;
			const uid =
				url.searchParams.get("uid")?.trim() ||
				(settings?.bilibili as { uid?: string } | undefined)?.uid ||
				siteConfig.bilibili?.uid;
			if (!uid) {
				return json({ error: "bilibili uid 未配置" }, 400);
			}
			const list = await fetchBilibiliList(String(uid));
			return json(list, 200, "private");
		});
	} catch (error) {
		return serverError(error);
	}
};

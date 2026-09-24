import type { SettingsView } from "@server/settings/service";
import type { APIRoute } from "astro";
import { siteConfig } from "@/config";
import { json, methodNotAllowed, serverError } from "@/lib/api";
import { withProxyGuard } from "@/lib/proxyCache";
import { fetchVndbUlist } from "@/utils/vndb-utils";

export const prerender = false;

// VNDB 用户列表同源代理：服务端持有 apiToken，token 不落前端
export const GET: APIRoute = async ({ request, url, locals }) => {
	try {
		return await withProxyGuard(request, url, async () => {
			type VndbGroup = NonNullable<typeof siteConfig.vndb> & {
				username?: string;
			};
			const settings = (locals as { settings?: SettingsView } | undefined)
				?.settings;
			const vndbSettings: VndbGroup =
				(settings?.vndb as VndbGroup | undefined) ?? siteConfig.vndb ?? {};
			const userId = vndbSettings.username || vndbSettings.userId || "";
			const apiToken = vndbSettings.apiToken || "";
			const apiUrl = vndbSettings.apiUrl || "https://api.vndb.org/kana";

			if (!userId.trim() || userId === "you-user-id" || !apiToken.trim()) {
				return json({ error: "VNDB userId / apiToken 未配置" }, 400);
			}

			const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
			const rawResults = Number(url.searchParams.get("results")) || 100;
			const results = Math.min(100, Math.max(1, Math.floor(rawResults)));

			const data = await fetchVndbUlist({
				apiUrl,
				userId,
				apiToken,
				results,
				page,
			});

			return json({ results: data.results, more: data.more }, 200, "private");
		});
	} catch (error) {
		return serverError(error);
	}
};

export const ALL: APIRoute = async () => methodNotAllowed(["GET"]);

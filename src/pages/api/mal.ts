import type { APIRoute } from "astro";
import { json, serverError } from "../../lib/api";
import { proxyCacheGet, proxyCachePut, proxyRateLimited } from "@/lib/proxyCache";
import { siteConfig } from "@/config";
import { fetchMalList, type MalListKind } from "@/utils/mal-utils";
import type { MalListItem } from "@/types/mal";

export const prerender = false;

// MAL 用户列表同源代理：服务端用 X-MAL-CLIENT-ID 拉取，clientId 不落前端
async function fetchAll(
	kind: MalListKind,
	opts: { apiUrl: string; username: string; clientId: string },
): Promise<MalListItem[]> {
	const limit = 100;
	const maxTotal = 1000;
	const delay = 100;
	const isDev = import.meta.env.DEV;
	const maxPages = isDev ? 1 : 0;
	let offset = 0;
	const allItems: MalListItem[] = [];

	while (true) {
		if (isDev && maxPages > 0 && allItems.length >= limit * maxPages) break;
		if (maxTotal > 0 && allItems.length >= maxTotal) break;

		const data = await fetchMalList({
			apiUrl: opts.apiUrl,
			username: opts.username,
			clientId: opts.clientId,
			kind,
			limit,
			offset,
		});
		const batch = data.data || [];
		allItems.push(...batch);

		if (!data.paging?.next || batch.length === 0) break;
		offset += limit;
		await new Promise((resolve) => setTimeout(resolve, delay));
	}

	return allItems;
}

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
		const malSettings =
			settings?.["myanimelist"] ?? settings?.["mal"] ?? (siteConfig as any).mal ?? {};
		const username = (malSettings.username as string | undefined) || "";
		const clientId = (malSettings.clientId as string | undefined) || "";
		const apiUrl =
			(malSettings.apiUrl as string | undefined) || "https://api.myanimelist.net/v2";

		if (!username.trim() || !clientId.trim()) {
			return json({ error: "MAL username / clientId 未配置" }, 400);
		}

		const [animeRes, mangaRes] = await Promise.allSettled([
			fetchAll("anime", { apiUrl, username, clientId }),
			fetchAll("manga", { apiUrl, username, clientId }),
		]);
		const anime = animeRes.status === "fulfilled" ? animeRes.value : [];
		const manga = mangaRes.status === "fulfilled" ? mangaRes.value : [];

		const body = json({ anime, manga }, 200, "private");
		await proxyCachePut(url, body.clone());
		return body;
	} catch (error) {
		return serverError(error);
	}
};

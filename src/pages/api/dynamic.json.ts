import type { APIRoute } from "astro";
import { getAllDynamics } from "../../../server/dynamic/service";
import { getSettingsVersionCached } from "../../../server/settings/service";
import { cfEnv, fromServiceError } from "../../lib/api";

export const prerender = false;

export const GET: APIRoute = async ({ request, url }) => {
	try {
		const version = await getSettingsVersionCached(cfEnv);
		const cacheKey = `${url.origin}/__dynamic_cache__/v=${version}`;

		let body: string | null = null;
		let hit = false;
		try {
			const cached = await caches.default.match(cacheKey);
			if (cached) {
				body = await cached.text();
				hit = true;
			}
		} catch {
			// 缓存不可用不影响主流程
		}

		if (body === null) {
			body = JSON.stringify(await getAllDynamics(cfEnv));
			try {
				await caches.default.put(
					cacheKey,
					new Response(body, {
						headers: { "Content-Type": "application/json; charset=utf-8" },
					}),
				);
			} catch {
				// 写入缓存失败不影响响应
			}
		}

		const etag = `W/"dv-${version}-${body.length}"`;
		const headers = {
			"Content-Type": "application/json; charset=utf-8",
			"Cache-Control": "public, max-age=0, must-revalidate",
			ETag: etag,
			"X-Firedre-Cache": hit ? "HIT" : "MISS",
		};
		if (request.headers.get("If-None-Match") === etag) {
			return new Response(null, { status: 304, headers });
		}
		return new Response(body, { headers });
	} catch (error) {
		return fromServiceError(error);
	}
};

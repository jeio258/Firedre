import {
	readIsolateCache,
	writeIsolateCache,
} from "@server/utils/isolateCache";
import type { APIRoute } from "astro";
import { cfEnv, methodNotAllowed, serverError } from "../../lib/api";

export const prerender = false;

// 版本化隔离级缓存：设置/内容变更（bump 版本）即失效，TTL 兜底直改 D1 场景
const CACHE_SLOT = "api.allPostMeta";

export const GET: APIRoute = async () => {
	try {
		const { getSettingsVersionCached } = await import(
			"@server/settings/service"
		);
		const version = await getSettingsVersionCached(cfEnv);
		let payload = readIsolateCache<string>(CACHE_SLOT, version);
		if (payload === undefined) {
			const { results } = await cfEnv.DB.prepare(`
				SELECT slug, title, description, date, categories, password
				FROM posts
				WHERE published = 1
				ORDER BY date DESC
			`).all();

			const data = (results || []).map((row: unknown) => {
				const r = row as Record<string, unknown>;
				return {
					id: r.slug as string,
					title: r.title as string,
					description: (r.description as string) || "",
					published: new Date(r.date as string).getTime(),
					category: (() => {
						try {
							const cats = JSON.parse((r.categories as string) || "[]");
							return Array.isArray(cats) && cats.length ? String(cats[0]) : "";
						} catch {
							return "";
						}
					})(),
					password: Boolean(r.password),
				};
			});

			payload = JSON.stringify(data);
			writeIsolateCache(CACHE_SLOT, version, payload);
		}
		return new Response(payload, {
			headers: {
				"Content-Type": "application/json; charset=utf-8",
				"Cache-Control": "no-store",
			},
		});
	} catch (error) {
		return serverError(error);
	}
};

export const ALL: APIRoute = async () => methodNotAllowed(["GET"]);

import { getAllPostMeta } from "@server/posts/allPostMeta";
import type { APIRoute } from "astro";
import { cfEnv, methodNotAllowed, serverError } from "../../lib/api";

export const prerender = false;

// 全量已发布文章元数据（Calendar / 推荐文章消费）。
// 取数与缓存见 server/posts/allPostMeta.ts：isolate 版本缓存 + D1 兜底，
// 与 SSR 直出（MainGridLayout → window.__allPostMetaCache）共用同一缓存 slot。
export const GET: APIRoute = async () => {
	try {
		const { getSettingsVersionCached } = await import(
			"@server/settings/service"
		);
		const version = await getSettingsVersionCached(cfEnv);
		const data = await getAllPostMeta(cfEnv, version);
		return new Response(JSON.stringify(data), {
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

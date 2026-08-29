import type { APIRoute } from "astro";
import { getAllDynamics } from "../../../server/dynamic/service";
import { cfEnv } from "../../lib/api";

export const prerender = false;

/**
 * 动态流数据：响应结构与 Firefly 原版 /api/dynamic.json 一致
 * （id / published(ms) / html / images / searchText / pinned / location）
 */
export const GET: APIRoute = async () => {
	const items = await getAllDynamics(cfEnv);
	return new Response(JSON.stringify(items), {
		headers: {
			"Content-Type": "application/json; charset=utf-8",
			"Cache-Control": "public, max-age=0, must-revalidate",
		},
	});
};

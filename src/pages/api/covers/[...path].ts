import type { APIRoute } from "astro";
import { cfEnv } from "../../../lib/api";

export const prerender = false;

/**
 * 文章封面对外服务：从 R2 covers/{slug}/{file} 读取并缓存
 */
export const GET: APIRoute = async ({ params }) => {
	const segments = (params.path || "").split("/").filter(Boolean);
	if (segments.length < 2) return new Response("Bad Request", { status: 400 });

	const slug = segments[0];
	const file = segments.slice(1).join("/");
	if (slug.includes("..") || file.includes("..") || file.includes("\\"))
		return new Response("Bad Request", { status: 400 });

	const key = `covers/${slug}/${file}`;
	const object = await cfEnv.BUCKET.get(key);
	if (!object) return new Response("Not Found", { status: 404 });

	const headers = new Headers();
	object.writeHttpMetadata(headers);
	headers.set(
		"Cache-Control",
		"public, max-age=86400, stale-while-revalidate=604800",
	);

	return new Response(object.body, { headers });
};

import type { APIRoute } from "astro";
import { cfEnv } from "../../../lib/api";
import { getAlbumPassword } from "../../../../server/gallery/password";
import { withRateLimit } from "../../../../server/utils/rateLimiter";
import { constantTimeEqual } from "../../../../server/utils/timingSafe";

export const prerender = false;

export const GET: APIRoute = async ({ params, request }) => {
	const segments = (params.path || "").split("/").filter(Boolean);
	if (segments.length < 2) return new Response("Bad Request", { status: 400 });

	const album = segments[0];
	const file = segments.slice(1).join("/");
	if (album.includes("..") || file.includes("..") || file.includes("\\"))
		return new Response("Bad Request", { status: 400 });

	const key =
		album === "_uploads"
			? `gallery/_uploads/${file}`
			: `gallery/${album}/files/${file}`;

	if (album !== "_uploads") {
		const expected = await getAlbumPassword(cfEnv, album);
		if (expected) {

			return withRateLimit(
				cfEnv,
				request,
				{
					windowMs: 60_000,
					maxRequests: 120,
					failOpen: false,
					scope: "gallery-files",
				},
				async () => {
					const supplied =
						new URL(request.url).searchParams.get("accessPassword") || "";
					if (!constantTimeEqual(supplied, expected))
						return new Response("Unauthorized", { status: 401 });
					// 加密相册：口令承载于 URL，禁止共享/CDN 长期缓存，避免口令 URL 扩散
					return serveFile(key, "private, no-store");
				},
			);
		}
	}

	// 非加密相册 / 全局上传：可公开缓存
	return serveFile(key, "public, max-age=86400, stale-while-revalidate=604800");
};

async function serveFile(key: string, cacheControl: string) {
	const object = await cfEnv.BUCKET.get(key);
	if (!object) return new Response("Not Found", { status: 404 });

	const headers = new Headers();
	object.writeHttpMetadata(headers);
	headers.set("Cache-Control", cacheControl);

	return new Response(object.body, { headers });
}

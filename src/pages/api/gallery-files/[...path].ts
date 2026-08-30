import type { APIRoute } from "astro";
import { cfEnv } from "../../../lib/api";
import { getAlbumPassword } from "../../../../server/gallery/password";
import { withRateLimit } from "../../../../server/utils/rateLimiter";
import { constantTimeEqual } from "../../../../server/utils/timingSafe";

export const prerender = false;

/**
 * 相册图片文件服务：从 R2 读取 gallery/{album}/files/{file} 并流式返回
 */
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

	// 相册专属文件（非 _uploads 全局上传目录）需校验相册加密口令：
	// 否则加密相册的图片文件可凭已知/猜测的路径直接下载，口令仅保护 URL 列表。
	// 口令存 D1（album_passwords），不写进 R2 frontmatter。
	// 锁门判定以 D1 密码是否存在为准（与 unlock/页面一致），并施加与解锁端点相同的
	// 限流（10次/分钟，failOpen=false），避免本端点成为绕过解锁限流的暴力破解 oracle。
	if (album !== "_uploads") {
		const expected = await getAlbumPassword(cfEnv, album);
		if (expected) {
			// 图片服务独立限流桶（scope: gallery-files），不与解锁/WebDAV/写文章共用，
			// 且预算放宽（加密相册每张图片一次请求，>10 图的合法相册也不应被误伤）。
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

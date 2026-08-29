import type { APIRoute } from "astro";
import { cfEnv } from "../../../lib/api";
import { getGalleryAlbum } from "../../../../server/gallery/service";
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
	if (album !== "_uploads") {
		const detail = await getGalleryAlbum(cfEnv, album);
		if (detail?.frontmatter.encrypted) {
			const expected = String(detail.frontmatter.password || "").trim();
			const supplied = new URL(request.url).searchParams.get("accessPassword") || "";
			if (!expected || !constantTimeEqual(supplied, expected))
				return new Response("Unauthorized", { status: 401 });
		}
	}

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

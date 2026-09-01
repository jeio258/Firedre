import type { APIRoute } from "astro";
import { verifyAdminRequest } from "../../../../server/auth/adminSession";
import { cfEnv, json, serverError, unauthorized } from "../../../lib/api";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
	const isAdmin = await verifyAdminRequest(request, cfEnv);
	if (!isAdmin) return unauthorized();

	try {
		const form = await request.formData();
		const file = form.get("file");
		if (!(file instanceof File) || !file.size)
			return json({ message: "缺少文件" }, 400);

		const MAX_FILE_SIZE = 5 * 1024 * 1024;       
		if (file.size > MAX_FILE_SIZE)
			return json({ message: "文件过大，最大支持 5MB" }, 400);

		const extMatch = /\.([a-zA-Z0-9]+)$/.exec(file.name || "");
		const ext = extMatch ? extMatch[1].toLowerCase() : "png";

		const allowed = new Set([
			"jpg",
			"jpeg",
			"png",
			"gif",
			"webp",
			"avif",
			"bmp",
		]);
		if (!allowed.has(ext)) return json({ message: "不支持的图片格式" }, 400);

		// 校验 MIME 类型与扩展名一致（防止伪造扩展名上传恶意内容）
		const mimeType = file.type.toLowerCase();
		const mimeMap: Record<string, string[]> = {
			jpg: ["image/jpeg"],
			jpeg: ["image/jpeg"],
			png: ["image/png"],
			gif: ["image/gif"],
			webp: ["image/webp"],
			avif: ["image/avif"],
			bmp: ["image/bmp"],
		};
		const validMimes = mimeMap[ext] || [];
		if (mimeType && validMimes.length > 0 && !validMimes.includes(mimeType)) {
			return json({ message: "文件内容与扩展名不匹配" }, 400);
		}

		const now = new Date();
		const uuid = crypto.randomUUID();
		const key = `gallery/_uploads/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${uuid}.${ext}`;

		const safeContentType = validMimes[0] || "application/octet-stream";

		await cfEnv.BUCKET.put(key, file.stream(), {
			httpMetadata: { contentType: safeContentType },
		});

		return json({
			ok: true,
			url: `/api/gallery-files/_uploads/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${uuid}.${ext}/`,
		});
	} catch (error) {
		return serverError(error);
	}
};

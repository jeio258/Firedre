import { verifyAdminRequest } from "@server/auth/adminSession";
import { withRateLimit } from "@server/utils/rateLimiter";
import type { APIRoute } from "astro";
import {
	cfEnv,
	json,
	methodNotAllowed,
	serverError,
	unauthorized,
} from "../../../lib/api";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
	const isAdmin = await verifyAdminRequest(request, cfEnv);
	if (!isAdmin) return unauthorized();

	return withRateLimit(
		cfEnv,
		request,
		{
			windowMs: 60_000,
			maxRequests: 10,
			scope: "upload-image",
			failOpen: false,
		},
		async () => {
			return handleUpload(request);
		},
	);
};

// 按文件头 magic bytes 判定真实图片格式（ext 已限定在白名单内）
export function matchesImageSignature(b: Uint8Array, ext: string): boolean {
	const ascii = (from: number, len: number) =>
		String.fromCharCode(...b.slice(from, from + len));
	switch (ext) {
		case "jpg":
		case "jpeg":
			return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
		case "png":
			return (
				b[0] === 0x89 &&
				b[1] === 0x50 &&
				b[2] === 0x4e &&
				b[3] === 0x47 &&
				b[4] === 0x0d &&
				b[5] === 0x0a &&
				b[6] === 0x1a &&
				b[7] === 0x0a
			);
		case "gif":
			return ascii(0, 4) === "GIF8";
		case "webp":
			return ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP";
		case "avif":
			// ISO BMFF：第 4-7 字节 "ftyp"，major brand 为 avif/avis
			return (
				ascii(4, 4) === "ftyp" &&
				(ascii(8, 4) === "avif" || ascii(8, 4) === "avis")
			);
		case "bmp":
			return b[0] === 0x42 && b[1] === 0x4d;
		default:
			return false;
	}
}

async function handleUpload(request: Request) {
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
		// MIME 缺失同样拒绝：无 Content-Type 的文件内容不可信
		if (!validMimes.includes(mimeType)) {
			return json({ message: "文件内容与扩展名不匹配" }, 400);
		}

		// magic-byte 校验：扩展名与 MIME 均由客户端提供，须再验文件头确认真实图片格式
		const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
		if (!matchesImageSignature(head, ext)) {
			return json({ message: "文件内容不是有效的图片" }, 400);
		}

		const now = new Date();
		const uuid = crypto.randomUUID();
		const key = `gallery/_uploads/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${uuid}.${ext}`;

		const safeContentType = validMimes[0] || "application/octet-stream";

		await cfEnv.BUCKET.put(key, await file.arrayBuffer(), {
			httpMetadata: { contentType: safeContentType },
		});

		const url = `/api/gallery-files/_uploads/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${uuid}.${ext}/`;
		return json({
			code: 0,
			msg: "",
			data: {
				succMap: { [file.name]: url },
				errFiles: [],
			},
			url,
			ok: true,
		});
	} catch (error) {
		return serverError(error);
	}
}

export const ALL: APIRoute = async () => methodNotAllowed(["POST"]);

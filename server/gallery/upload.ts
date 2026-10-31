import type { CloudflareEnv } from "../../types/env";

export const GALLERY_UPLOAD_MAX_SIZE = 25 * 1024 * 1024;

const GALLERY_IMAGE_EXT = new Set([
	"jpg",
	"jpeg",
	"png",
	"webp",
	"avif",
	"gif",
]);

const GALLERY_VIDEO_EXT = new Set(["mp4", "webm", "mov"]);

export type GalleryUploadMediaType = "image" | "video";

export function detectGalleryUploadType(
	fileName: string,
): GalleryUploadMediaType | null {
	const ext = /\.([a-zA-Z0-9]+)$/.exec(fileName || "")?.[1].toLowerCase();
	if (!ext) return null;
	if (GALLERY_IMAGE_EXT.has(ext)) return "image";
	if (GALLERY_VIDEO_EXT.has(ext)) return "video";
	return null;
}

export function sanitizeGalleryUploadName(fileName: string): string {
	const trimmed = (fileName || "").trim();
	const dot = trimmed.lastIndexOf(".");
	const base = dot > 0 ? trimmed.slice(0, dot) : trimmed;
	const ext = dot > 0 ? trimmed.slice(dot + 1) : "";
	const clean = (s: string) => s.replace(/[^A-Za-z0-9_-]/g, "-");
	const cleanBase = clean(base) || "file";
	const cleanExt = clean(ext);
	return cleanExt ? `${cleanBase}.${cleanExt}` : cleanBase;
}

export async function putGalleryFile(
	env: CloudflareEnv,
	slug: string,
	file: File,
	safeName: string,
): Promise<string> {
	const objectName = `${Date.now()}-${safeName}`;
	await env.BUCKET.put(
		`gallery/${slug}/files/${objectName}`,
		await file.arrayBuffer(),
		{
			httpMetadata: { contentType: file.type || "application/octet-stream" },
		},
	);
	return `/api/gallery-files/${slug}/files/${objectName}`;
}

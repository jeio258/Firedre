

import type { AlbumPhoto } from "../../types/album";
import { detectMediaTypeFromMime } from "../../utils/albumMedia";
import { UserError } from "../utils/userError";

export interface ImgbedListFile {
	name: string;
	metadata?: {
		"File-Mime"?: string;
		FileType?: string;
		"File-Size"?: string;
		Channel?: string;
		TimeStamp?: string | number;
	};
}

const IMAGE_EXT =
	/\.(jpe?g|png|gif|webp|avif|bmp|heic|heif|ico|mp4|webm|mov|mkv|avi|m4v|ogv|wmv)$/i;

export function inferFileBase(listUrl: string): string {
	try {
		const u = new URL(listUrl);
		return `${u.protocol}//${u.host}/file/`;
	} catch {
		return `${listUrl.replace(/\/$/, "")}/file/`;
	}
}

export async function fetchImgbedPhotos(
	listUrl: string,
	token: string,
	dir: string,
): Promise<AlbumPhoto[]> {
	if (!listUrl || !token) throw new UserError("图床配置不完整");
	if (!/^https?:\/\//.test(listUrl))
		throw new UserError("图床 API 端点需以 http(s):// 开头");

	const dirName = dir.trim().replace(/^\/+|\/+$/g, "");

	const reqUrl = dirName
		? `${listUrl}?dir=${encodeURIComponent(dirName)}&count=-1`
		: `${listUrl}?count=-1`;

	const response = await fetch(reqUrl, {
		headers: { Authorization: `Bearer ${token}` },
	});

	if (!response.ok)
		throw new UserError(
			`图床列目录失败 (${response.status})，请检查 API 端点/密钥/目录`,
		);

	let data: { files?: ImgbedListFile[] } = {};
	try {
		data = (await response.json()) as { files?: ImgbedListFile[] };
	} catch {
		throw new UserError("图床返回了无法解析的响应");
	}

	const files = Array.isArray(data.files) ? data.files : [];
	if (!files.length) throw new UserError("图床目录中未找到文件");

	const fileBase = inferFileBase(listUrl);
	const photos: AlbumPhoto[] = [];
	for (const file of files) {
		const name = typeof file?.name === "string" ? file.name.trim() : "";
		if (!name || !IMAGE_EXT.test(name.split("?")[0])) continue;

		const url = `${fileBase}${name.replace(/^\/+/, "")}`;

		const mime = file.metadata?.["File-Mime"] ?? file.metadata?.FileType ?? "";
		const type = detectMediaTypeFromMime(mime) || undefined;
		photos.push({ url, ...(type ? { type } : {}) });
	}

	if (!photos.length) throw new UserError("图床目录中没有图片或视频文件");
	return photos;
}

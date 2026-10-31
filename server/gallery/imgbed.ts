import type { AlbumPhoto } from "../../types/album";
import { detectMediaTypeFromMime, MEDIA_EXT } from "../utils/albumMedia";
import { fetchWithRetry } from "../utils/fetchRetry";
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

export function inferFileBase(listUrl: string): string {
	try {
		const u = new URL(listUrl);
		return `${u.protocol}//${u.host}/file/`;
	} catch {
		return `${listUrl.replace(/\/$/, "")}/file/`;
	}
}

async function listImgbedFiles(
	listUrl: string,
	token: string,
	dir: string,
): Promise<ImgbedListFile[]> {
	if (!listUrl || !token) throw new UserError("图床配置不完整");
	if (!/^https?:\/\//.test(listUrl))
		throw new UserError("图床 API 端点需以 http(s):// 开头");

	const dirName = dir.trim().replace(/^\/+|\/+$/g, "");

	const reqUrl = dirName
		? `${listUrl}?dir=${encodeURIComponent(dirName)}&count=-1`
		: `${listUrl}?count=-1`;

	const response = await fetchWithRetry(reqUrl, {
		headers: { Authorization: `Bearer ${token}` },
	});

	if (!response.ok)
		throw new UserError(
			`图床列目录失败 (${response.status})，请检查 API 端点/密钥/目录`,
		);

	try {
		const data = (await response.json()) as { files?: ImgbedListFile[] };
		return Array.isArray(data.files) ? data.files : [];
	} catch {
		throw new UserError("图床返回了无法解析的响应");
	}
}

export async function fetchImgbedPhotos(
	listUrl: string,
	token: string,
	dir: string,
): Promise<AlbumPhoto[]> {
	const files = await listImgbedFiles(listUrl, token, dir);
	if (!files.length) throw new UserError("图床目录中未找到文件");

	const fileBase = inferFileBase(listUrl);
	const photos: AlbumPhoto[] = [];
	for (const file of files) {
		const name = typeof file?.name === "string" ? file.name.trim() : "";
		if (!name || !MEDIA_EXT.test(name.split("?")[0])) continue;

		const url = `${fileBase}${name.replace(/^\/+/, "")}`;

		const mime = file.metadata?.["File-Mime"] ?? file.metadata?.FileType ?? "";
		const type = detectMediaTypeFromMime(mime) || undefined;
		photos.push({ url, ...(type ? { type } : {}) });
	}

	if (!photos.length) throw new UserError("图床目录中没有图片或视频文件");
	return photos;
}

// 连通性测试：目录为空不算失败，仅验证端点/密钥可达且响应可解析
export async function testImgbedConnection(
	listUrl: string,
	token: string,
	dir: string,
): Promise<{ count: number }> {
	const files = await listImgbedFiles(listUrl, token, dir);
	return { count: files.length };
}

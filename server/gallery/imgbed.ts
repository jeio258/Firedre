/**
 * 图床图片获取服务（图传 API 方式，方案①）。
 *
 * 通用模式（cfbed / 兰空 LskyPro 等主流开源图床一致）：
 * - 鉴权：Authorization: Bearer <token>
 * - 获取文件列表：GET {endpoint}/api/manage/list?dir={dir}&count=-1
 *   → 响应 { files: [{ name, metadata: { File-Mime } }] }
 * - 图片公开读取：GET {endpoint}/file/{name}（无需鉴权，浏览器直接 <img>）
 *
 * 图片直链写进相册 frontmatter.photos，相册 source 保持 local（公开直链本质相同），
 * 前端展示链路（[album].astro / PhotoCard 的 <img src>）完全无需改动。
 */

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

/**
 * 从图床拉取指定目录的文件列表，拼成公开直链 AlbumPhoto[]。
 * @param endpoint 图床 API 端点（不含尾部斜杠），如 https://cfbed.sanyue.de
 * @param token    API 密钥（Bearer）
 * @param dir      图片所在目录（相册 slug）
 */
export async function fetchImgbedPhotos(
	endpoint: string,
	token: string,
	dir: string,
): Promise<AlbumPhoto[]> {
	if (!endpoint || !token) throw new UserError("图床配置不完整");
	if (!/^https?:\/\//.test(endpoint))
		throw new UserError("图床 API 端点需以 http(s):// 开头");

	const dirName = dir.trim().replace(/^\/+|\/+$/g, "");
	if (!dirName) throw new UserError("缺少图片目录");

	const listUrl = `${endpoint}/api/manage/list?dir=${encodeURIComponent(
		dirName,
	)}&count=-1`;

	const response = await fetch(listUrl, {
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

	const photos: AlbumPhoto[] = [];
	for (const file of files) {
		const name = typeof file?.name === "string" ? file.name.trim() : "";
		if (!name || !IMAGE_EXT.test(name.split("?")[0])) continue;

		const url = `${endpoint}/file/${name.replace(/^\/+/, "")}`;
		// 兼容不同图床的 MIME 字段名：cfbed 用 File-Mime，imge 等用 FileType
		const mime = file.metadata?.["File-Mime"] ?? file.metadata?.FileType ?? "";
		const type = detectMediaTypeFromMime(mime) || undefined;
		photos.push({ url, ...(type ? { type } : {}) });
	}

	if (!photos.length) throw new UserError("图床目录中没有图片或视频文件");
	return photos;
}

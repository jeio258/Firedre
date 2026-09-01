/**
 * 图床图片获取服务（图传 API 方式，方案①）。
 *
 * 通用模式（cfbed / 兰空 LskyPro 等主流开源图床一致）：
 * - 鉴权：Authorization: Bearer <token>
 * - 获取文件列表：GET {listUrl}?dir={dir}&count=-1（listUrl 为完整列表接口 URL，用户直接填写）
 *   （dir 为空则不带 dir 参数，从根目录拉取）
 *   → 响应 { files: [{ name, metadata: { File-Mime } }] }
 * - 图片公开读取：GET {fileBase}{name}（无需鉴权，浏览器直接 <img>），fileBase 从 listUrl 推导
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
 * 从完整列表接口 URL 推导公开直链前缀。
 * 列表接口返回的只是文件名（无完整 URL），直链需拼前缀：{origin}/file/{name}。
 * @param listUrl 完整列表接口 URL，如 https://imge.994613.xyz/api/manage/list
 * @returns 如 https://imge.994613.xyz/file/
 */
export function inferFileBase(listUrl: string): string {
	try {
		const u = new URL(listUrl);
		return `${u.protocol}//${u.host}/file/`;
	} catch {
		return `${listUrl.replace(/\/$/, "")}/file/`;
	}
}

/**
 * 从图床拉取文件列表，拼成公开直链 AlbumPhoto[]。
 * @param listUrl 完整列表接口 URL（用户直接填写），如 https://imge.994613.xyz/api/manage/list
 * @param token   API 密钥（Bearer）
 * @param dir     图床目录（可选；留空 = 根目录，不携带 dir 参数）
 */
export async function fetchImgbedPhotos(
	listUrl: string,
	token: string,
	dir: string,
): Promise<AlbumPhoto[]> {
	if (!listUrl || !token) throw new UserError("图床配置不完整");
	if (!/^https?:\/\//.test(listUrl))
		throw new UserError("图床 API 端点需以 http(s):// 开头");

	const dirName = dir.trim().replace(/^\/+|\/+$/g, "");
	// listUrl 即完整列表接口，直接使用；目录留空 = 根目录，不携带 dir 参数
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
		// 兼容不同图床的 MIME 字段名：cfbed 用 File-Mime，imge 等用 FileType
		const mime = file.metadata?.["File-Mime"] ?? file.metadata?.FileType ?? "";
		const type = detectMediaTypeFromMime(mime) || undefined;
		photos.push({ url, ...(type ? { type } : {}) });
	}

	if (!photos.length) throw new UserError("图床目录中没有图片或视频文件");
	return photos;
}

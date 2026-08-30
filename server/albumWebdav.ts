import type { AlbumPhoto, AlbumWebDavConfig } from "../types/album";
import type { CloudflareEnv } from "../types/env";
import {
	type AlbumAccessParams,
	verifyAlbumAccess,
} from "../utils/albumAuth";
import { UserError } from "./utils/userError";
import {
	detectMediaTypeFromMime,
	detectMediaTypeFromUrl,
} from "../utils/albumMedia";
import {
	assertTargetInWebDavScope,
	resolveWebDavConfig,
} from "./albumWebdavEnv";

export interface AlbumWebDavRuntimeOptions {
	env?: CloudflareEnv;
	runtimeEnv?: Record<string, string | undefined>;
}

function assertAlbumAccess(access: AlbumAccessParams) {
	if (!verifyAlbumAccess(access)) throw new UserError("需要正确的相册访问密码");
}

const MEDIA_EXT =
	/\.(jpe?g|png|gif|webp|avif|bmp|heic|heif|ico|mp4|webm|mov|mkv|avi|m4v|ogv|wmv)$/i;

export function basicAuthHeader(username?: string, password?: string) {
	if (!username) return undefined;
	return `Basic ${Buffer.from(`${username}:${password ?? ""}`, "utf-8").toString("base64")}`;
}

function decodeHref(href: string) {
	try {
		return decodeURIComponent(href);
	} catch {
		return href;
	}
}

export function resolvePhotoUrl(baseUrl: string, href: string) {
	if (/^https?:\/\//i.test(href)) return href;

	if (href.startsWith("/")) {
		const origin = new URL(baseUrl).origin;
		return `${origin}${href}`;
	}

	const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
	return new URL(href, base).href;
}

export function parseWebDavPropfindXml(
	xml: string,
	baseUrl: string,
): AlbumPhoto[] {
	const entries: {
		href: string;
		lastModified?: string;
		contentType?: string;
	}[] = [];
	const responseBlocks =
		xml.match(
			/<(?:[a-z0-9]+:)?response[\s\S]*?<\/(?:[a-z0-9]+:)?response>/gi,
		) ?? [];

	for (const block of responseBlocks) {
		const hrefMatch = block.match(
			/<(?:[a-z0-9]+:)?href>([\s\S]*?)<\/(?:[a-z0-9]+:)?href>/i,
		);
		if (!hrefMatch) continue;

		const href = decodeHref(hrefMatch[1].trim());
		const modifiedMatch = block.match(
			/<(?:[a-z0-9]+:)?getlastmodified>([\s\S]*?)<\/(?:[a-z0-9]+:)?getlastmodified>/i,
		);
		const contentTypeMatch = block.match(
			/<(?:[a-z0-9]+:)?getcontenttype>([\s\S]*?)<\/(?:[a-z0-9]+:)?getcontenttype>/i,
		);
		entries.push({
			href,
			lastModified: modifiedMatch?.[1]?.trim(),
			contentType: contentTypeMatch?.[1]?.trim(),
		});
	}

	const photos: AlbumPhoto[] = [];
	const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;

	for (const entry of entries) {
		const name = fileNameFromHref(entry.href);
		if (!name || !MEDIA_EXT.test(name)) continue;

		const photoUrl = resolvePhotoUrl(normalizedBase, entry.href);
		if (photoUrl.replace(/\/$/, "") === normalizedBase.replace(/\/$/, ""))
			continue;

		const type =
			detectMediaTypeFromMime(entry.contentType) ||
			detectMediaTypeFromUrl(photoUrl) ||
			undefined;
		if (!type) continue;

		photos.push({
			url: photoUrl,
			type,
			date: toPhotoDate(entry.lastModified),
		});
	}

	return photos.sort((a, b) => {
		const ta = a.date ? Date.parse(a.date) : 0;
		const tb = b.date ? Date.parse(b.date) : 0;
		return tb - ta;
	});
}

function toPhotoDate(lastModified?: string) {
	if (!lastModified) return undefined;
	const parsed = Date.parse(lastModified);
	if (Number.isNaN(parsed)) return undefined;
	return new Date(parsed).toISOString().slice(0, 10);
}

function fileNameFromHref(href: string) {
	const clean = href.split("?")[0].replace(/\/$/, "");
	const parts = clean.split("/");
	return decodeHref(parts[parts.length - 1] || "");
}

export async function propfindWebDavAlbum(
	config: AlbumWebDavConfig,
): Promise<AlbumPhoto[]> {
	const url = config.url.endsWith("/") ? config.url : `${config.url}/`;
	const headers: Record<string, string> = {
		Depth: "1",
		"Content-Type": "application/xml; charset=utf-8",
	};

	const auth = basicAuthHeader(config.username, config.password);
	if (auth) headers.Authorization = auth;

	const body = `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:">
  <d:prop>
    <d:displayname/>
    <d:getlastmodified/>
    <d:getcontenttype/>
  </d:prop>
</d:propfind>`;

	const response = await fetch(url, {
		method: "PROPFIND",
		headers,
		body,
	});

	if (!response.ok && response.status !== 207)
		throw new Error(`WebDAV 请求失败 (${response.status})`);

	const xml = await response.text();
	const photos = parseWebDavPropfindXml(xml, url);

	if (!photos.length) throw new Error("WebDAV 目录中未找到图片或视频文件");

	return photos;
}

export async function fetchWebDavFile(
	url: string,
	config: Pick<AlbumWebDavConfig, "username" | "password">,
	options?: { range?: string },
) {
	const headers: Record<string, string> = {};
	const auth = basicAuthHeader(config.username, config.password);
	if (auth) headers.Authorization = auth;
	if (options?.range) headers.Range = options.range;

	const response = await fetch(url, { headers });
	if (!response.ok && response.status !== 206)
		throw new Error(`媒体文件加载失败 (${response.status})`);

	return response;
}

export interface AlbumWebDavFileResult {
	contentType: string;
	buffer: Buffer;
	status: number;
	contentRange?: string | null;
	contentLength?: string | null;
}

export interface AlbumWebDavListRequest {
	slug: string;
	encrypted?: boolean | string;
	albumPassword?: string;
	accessPassword?: string;
}

export async function handleAlbumWebDavList(
	body: AlbumWebDavListRequest,
	options?: AlbumWebDavRuntimeOptions,
) {
	const config = await resolveWebDavConfig(body.slug, options);
	// 以服务端相册 frontmatter 的 encrypted 状态为准，绝不信任客户端声明
	assertAlbumAccess({
		encrypted: config.encrypted,
		password: config.albumPassword,
		accessPassword: body.accessPassword,
	});
	const photos = await propfindWebDavAlbum(config);
	return { photos };
}

export async function handleAlbumWebDavFile(
	slug: string,
	targetUrl: string,
	accessQuery: {
		encrypted?: boolean | string;
		albumPassword?: string;
		accessPassword?: string;
	},
	range?: string,
	options?: AlbumWebDavRuntimeOptions,
) {
	if (!targetUrl) throw new UserError("缺少媒体地址");

	const config = await resolveWebDavConfig(slug, options);
	// 以服务端相册 frontmatter 的 encrypted 状态为准，绝不信任客户端声明
	assertAlbumAccess({
		encrypted: config.encrypted,
		password: config.albumPassword,
		accessPassword: accessQuery.accessPassword,
	});
	assertTargetInWebDavScope(targetUrl, config.url);

	const response = await fetchWebDavFile(targetUrl, config, { range });
	const contentType =
		response.headers.get("content-type") || "application/octet-stream";
	const buffer = Buffer.from(await response.arrayBuffer());

	return {
		contentType,
		buffer,
		status: response.status,
		contentRange: response.headers.get("content-range"),
		contentLength: response.headers.get("content-length"),
	};
}

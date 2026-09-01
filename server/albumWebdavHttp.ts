import type { CloudflareEnv } from "../types/env";
import { handleAlbumWebDavFile, handleAlbumWebDavList } from "./albumWebdav";
import { withRateLimit } from "./utils/rateLimiter";

export type AlbumWebdavRuntimeEnv = Record<string, string | undefined>;

export interface AlbumWebdavHttpOptions {
	runtimeEnv?: AlbumWebdavRuntimeEnv;
	env?: CloudflareEnv;
}

function jsonResponse(data: unknown, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: { "Content-Type": "application/json; charset=utf-8" },
	});
}

function parseAccessFromSearchParams(params: URLSearchParams) {
	return {
		encrypted: params.get("encrypted") || undefined,
		albumPassword: params.get("albumPassword") || undefined,
		accessPassword: params.get("accessPassword") || undefined,
	};
}

export async function handleAlbumWebdavHttp(
	request: Request,
	options?: AlbumWebdavHttpOptions,
): Promise<Response> {
	const url = new URL(request.url);
	const pathname = url.pathname;
	const runtimeOptions = {
		env: options?.env,
		runtimeEnv: options?.runtimeEnv,
	};

	try {
		if (pathname.endsWith("/file") || url.searchParams.has("url")) {

			return withRateLimit(
				options?.env ?? ({} as CloudflareEnv),
				request,
				{
					windowMs: 60_000,
					maxRequests: 120,
					failOpen: false,
					scope: "album-webdav-file",
				},
				() => handleWebDavFile(request, url, runtimeOptions),
			);
		}

		if (
			pathname.endsWith("/list") &&
			(request.method === "GET" || request.method === "POST")
		) {
			return withRateLimit(
				options?.env ?? ({} as CloudflareEnv),
				request,
				{
					windowMs: 60_000,
					maxRequests: 30,
					failOpen: false,
					scope: "album-webdav-list",
				},
				() => handleWebDavList(request, url, runtimeOptions),
			);
		}

		return jsonResponse({ message: "Not found" }, 404);
	} catch (error) {
		return jsonResponse(
			{
				message: error instanceof Error ? error.message : "WebDAV 代理失败",
			},
			500,
		);
	}
}

async function handleWebDavFile(
	request: Request,
	url: URL,
	runtimeOptions: AlbumWebdavRuntimeOptions,
): Promise<Response> {
	const slug = url.searchParams.get("slug") || "";
	const target = url.searchParams.get("url");
	const access = parseAccessFromSearchParams(url.searchParams);

	if (!slug) return jsonResponse({ message: "缺少相册标识" }, 400);
	if (!target) return jsonResponse({ message: "缺少媒体地址" }, 400);

	const range =
		request.headers.get("range") || request.headers.get("Range") || undefined;
	const file = await handleAlbumWebDavFile(
		slug,
		target,
		access,
		range,
		runtimeOptions,
	);
	const headers = new Headers({
		"Content-Type": file.contentType,
		"Accept-Ranges": "bytes",

		"Cache-Control": "private, no-store",
	});
	if (file.contentRange) headers.set("Content-Range", file.contentRange);
	if (file.contentLength) headers.set("Content-Length", file.contentLength);

	return new Response(file.buffer, { status: file.status, headers });
}

async function handleWebDavList(
	request: Request,
	url: URL,
	runtimeOptions: AlbumWebdavRuntimeOptions,
): Promise<Response> {
	let body: Record<string, string | undefined>;

	if (request.method === "GET") {
		body = {
			slug: url.searchParams.get("slug") || undefined,
			encrypted: url.searchParams.get("encrypted") || undefined,
			albumPassword: url.searchParams.get("albumPassword") || undefined,
			accessPassword: url.searchParams.get("accessPassword") || undefined,
		};
	} else {
		body = (await request.json().catch(() => ({}))) as Record<
			string,
			string | undefined
		>;
	}

	const result = await handleAlbumWebDavList(
		{
			slug: body.slug || "",
			encrypted: body.encrypted,
			albumPassword: body.albumPassword,
			accessPassword: body.accessPassword,
		},
		runtimeOptions,
	);
	return jsonResponse(result);
}

interface AlbumWebdavRuntimeOptions {
	env?: CloudflareEnv;
	runtimeEnv?: Record<string, string | undefined>;
}

import type { CloudflareEnv } from "../types/env";
import { handleAlbumWebDavFile, handleAlbumWebDavList } from "./albumWebdav";
import { WEBDAV_PASSWORD_ENV } from "./albumWebdavEnv";

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
			const slug = url.searchParams.get("slug") || "";
			const target = url.searchParams.get("url");
			const access = parseAccessFromSearchParams(url.searchParams);

			if (!slug) return jsonResponse({ message: "缺少相册标识" }, 400);

			if (!target) return jsonResponse({ message: "缺少媒体地址" }, 400);

			const range =
				request.headers.get("range") ||
				request.headers.get("Range") ||
				undefined;
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
				"Cache-Control": "private, max-age=3600",
			});
			if (file.contentRange) headers.set("Content-Range", file.contentRange);
			if (file.contentLength) headers.set("Content-Length", file.contentLength);

			return new Response(file.buffer, { status: file.status, headers });
		}

		if (
			pathname.endsWith("/list") &&
			(request.method === "GET" || request.method === "POST")
		) {
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

export function buildAlbumWebdavRequestUrl(input: {
	host: string;
	path: string;
	rawUrl?: string;
}) {
	if (input.rawUrl) return input.rawUrl;

	const path = input.path.startsWith("/") ? input.path : `/${input.path}`;
	return `https://${input.host}${path}`;
}

export async function albumWebdavHttpToNetlifyResult(response: Response) {
	const contentType = response.headers.get("content-type") || "";
	const isJson = contentType.includes("application/json");
	const headers = Object.fromEntries(response.headers.entries());

	if (isJson) {
		return {
			statusCode: response.status,
			headers,
			body: await response.text(),
		};
	}

	const buffer = Buffer.from(await response.arrayBuffer());
	return {
		statusCode: response.status,
		headers,
		body: buffer.toString("base64"),
		isBase64Encoded: true,
	};
}

export { WEBDAV_PASSWORD_ENV };

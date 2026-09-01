import type { APIRoute } from "astro";
import { verifyAdminRequest } from "../../../../server/auth/adminSession";
import { isValidGallerySlug } from "../../../../server/gallery/constants";
import {
	deleteAlbumPassword,
	getAlbumPassword,
	setAlbumPassword,
} from "../../../../server/gallery/password";
import { sanitizeGalleryAlbumForPublic } from "../../../../server/gallery/sanitize";
import {
	deleteGalleryAlbum,
	getGalleryAlbum,
	getGalleryHub,
	setAlbumEncryptedFlag,
	setAlbumSourceFlag,
	unlockGalleryAlbum,
	updateGalleryAlbumOrder,
	upsertGalleryAlbum,
	upsertGalleryHub,
} from "../../../../server/gallery/service";
import {
	deleteAlbumWebDavConfig,
	getAlbumWebDavConfig,
	setAlbumWebDavConfig,
} from "../../../../server/gallery/webdavConfig";
import { withRateLimit } from "../../../../server/utils/rateLimiter";
import {
	badRequest,
	cfEnv,
	fromServiceError,
	json,
	methodNotAllowed,
	notFound,
	unauthorized,
} from "../../../lib/api";

export const prerender = false;

export const GET: APIRoute = async ({ params, request }) => {
	const segments = (params.path || "").split("/").filter(Boolean);
	const isAdmin = await verifyAdminRequest(request, cfEnv);

	try {
		if (segments.length === 0) {
			const hub = await getGalleryHub(cfEnv, { includeSource: isAdmin });
			if (!hub) return notFound("相册数据不存在");
			return json(hub, 200, isAdmin ? "private" : "default");
		}

		const slug = segments[0];
		if (!isValidGallerySlug(slug)) return badRequest("相册 slug 格式无效");

		if (segments[1] === "password") {
			// 查询相册是否已设密码（不返回密码本身，仅布尔）——仅管理员
			if (!isAdmin) return unauthorized();
			const existing = await getAlbumPassword(cfEnv, slug);
			return json({ hasPassword: !!existing }, 200, "private");
		}

		if (segments[1] === "webdav") {
			// 查询相册 WebDAV 源配置（url/username，存 D1）——仅管理员
			if (!isAdmin) return unauthorized();
			const config = await getAlbumWebDavConfig(cfEnv, slug);
			return json({ ok: true, config }, 200, "private");
		}

		if (segments[1] === "unlock" && request.method === "GET") {

			return withRateLimit(
				cfEnv,
				request,
				{
					windowMs: 60_000,
					maxRequests: 10,
					failOpen: false,
					scope: "gallery-unlock",
				},
				async () => {
					const password =
						new URL(request.url).searchParams.get("password") || "";
					const result = await unlockGalleryAlbum(cfEnv, slug, password);
					if (!result.ok) return json({ message: "密码错误" }, 403);
					return json({ ok: true, photos: result.photos });
				},
			);
		}

		const album = await getGalleryAlbum(cfEnv, slug, {
			includeSource: isAdmin,
		});
		if (!album) return notFound("相册不存在");

		const hasPassword = (await getAlbumPassword(cfEnv, slug)) !== "";
		const payload = isAdmin
			? album
			: sanitizeGalleryAlbumForPublic(album, hasPassword);
		return json(payload, 200, "private");
	} catch (error) {
		return fromServiceError(error);
	}
};

export const POST: APIRoute = async ({ params, request }) => {
	const segments = (params.path || "").split("/").filter(Boolean);
	const slug = segments[0];
	if (!slug || !isValidGallerySlug(slug)) return notFound();

	if (segments[1] === "imgbed" && segments[2] === "photos") {
		const isAdmin = await verifyAdminRequest(request, cfEnv);
		if (!isAdmin) return unauthorized();
		return withRateLimit(
			cfEnv,
			request,
			{
				windowMs: 60_000,
				maxRequests: 10,
				failOpen: false,
				scope: "imgbed-fetch",
			},
			async () => {
				try {
					const { getImgbedConfig } = await import(
						"../../../../server/gallery/imgbedConfig"
					);
					const { fetchImgbedPhotos } = await import(
						"../../../../server/gallery/imgbed"
					);
					const { setAlbumPhotos, upsertGalleryAlbum } = await import(
						"../../../../server/gallery/service"
					);
					const cfg = await getImgbedConfig(cfEnv);
					if (!cfg)
						return badRequest(
							"未配置图床 API（请先在站点设置 → 相册 配置端点与密钥）",
						);

					const existing = await getGalleryAlbum(cfEnv, slug);
					if (!existing) {
						await upsertGalleryAlbum(
							cfEnv,
							slug,
							`---\nlayout: gallery-album\ntitle: ${slug}\nsource: local\n---\n`,
						);
					}
					const photos = await fetchImgbedPhotos(
						cfg.endpoint,
						cfg.token,
						cfg.dir,
					);
					await setAlbumPhotos(cfEnv, slug, photos);
					return json({ ok: true, count: photos.length, photos });
				} catch (error) {
					return fromServiceError(error);
				}
			},
		);
	}

	return withRateLimit(
		cfEnv,
		request,
		{
			windowMs: 60_000,
			maxRequests: 10,
			failOpen: false,
			scope: "gallery-unlock",
		},
		async () => {
			const body = (await request.json().catch(() => ({}))) as {
				password?: string;
			};
			const result = await unlockGalleryAlbum(
				cfEnv,
				slug,
				String(body.password || ""),
			);
			if (!result.ok) return json({ message: "密码错误" }, 403);
			return json({ ok: true, photos: result.photos });
		},
	);
};

export const PUT: APIRoute = async ({ params, request }) => {
	const segments = (params.path || "").split("/").filter(Boolean);
	const isAdmin = await verifyAdminRequest(request, cfEnv);
	if (!isAdmin) return unauthorized();

	try {
		const slug = segments[0];

		if (segments.length === 1 && slug === "order") {
			const body = (await request.json().catch(() => ({}))) as {
				slugs?: unknown;
			};
			if (!Array.isArray(body.slugs)) return badRequest("slugs 需为数组");
			const slugs = body.slugs.map(String);
			const result = await updateGalleryAlbumOrder(cfEnv, slugs);
			return json({ ok: true, albums: result.albums });
		}

		if (segments[1] === "password") {
			if (!slug || !isValidGallerySlug(slug))
				return badRequest("相册 slug 格式无效");
			const body = (await request.json().catch(() => ({}))) as {
				password?: string;
			};
			const pwd = String(body.password || "").trim();

			await setAlbumPassword(cfEnv, slug, pwd);
			await setAlbumEncryptedFlag(cfEnv, slug, !!pwd);
			return json({ ok: true, hasPassword: !!pwd });
		}

		if (segments[1] === "webdav") {
			if (!slug || !isValidGallerySlug(slug))
				return badRequest("相册 slug 格式无效");
			const body = (await request.json().catch(() => ({}))) as {
				url?: string;
				username?: string;
			};
			const url = String(body.url || "").trim();
			if (!url) return badRequest("WebDAV 地址不能为空");
			// 仅接受 http/https，防任意协议注入
			if (!/^https?:\/\//.test(url))
				return badRequest("WebDAV 地址需以 http(s):// 开头");
			await setAlbumWebDavConfig(cfEnv, slug, url, body.username);
			// 同步 frontmatter source 标记为 webdav
			await setAlbumSourceFlag(cfEnv, slug, "webdav");
			return json({ ok: true });
		}

		if (segments.length === 0) {
			const body = await request.text();
			if (!body.trim()) return badRequest("内容不能为空");
			const result = await upsertGalleryHub(cfEnv, body);
			return json({ ok: true, ...result });
		}

		if (!slug || !isValidGallerySlug(slug))
			return badRequest("相册 slug 格式无效");
		const body = await request.text();
		if (!body.trim()) return badRequest("内容不能为空");
		const result = await upsertGalleryAlbum(cfEnv, slug, body);
		return json({ ok: true, ...result });
	} catch (error) {
		return fromServiceError(error);
	}
};

export const DELETE: APIRoute = async ({ params, request }) => {
	const segments = (params.path || "").split("/").filter(Boolean);
	const slug = segments[0];
	if (!slug || !isValidGallerySlug(slug))
		return badRequest("相册 slug 格式无效");

	const isAdmin = await verifyAdminRequest(request, cfEnv);
	if (!isAdmin) return unauthorized();

	try {

		if (segments[1] === "password") {
			await deleteAlbumPassword(cfEnv, slug);
			// 同步清除 R2 frontmatter 的 encrypted 标记
			await setAlbumEncryptedFlag(cfEnv, slug, false);
			return json({ ok: true, hasPassword: false });
		}

		if (segments[1] === "webdav") {
			await deleteAlbumWebDavConfig(cfEnv, slug);
			await setAlbumSourceFlag(cfEnv, slug, "local");
			return json({ ok: true });
		}

		const result = await deleteGalleryAlbum(cfEnv, slug);
		return json({ ok: true, ...result });
	} catch (error) {
		return fromServiceError(error);
	}
};

export const ALL: APIRoute = async () => methodNotAllowed();

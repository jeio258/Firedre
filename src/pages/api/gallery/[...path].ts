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
			// 解锁限流：防暴力破解相册密码（D1 持久化，跨边缘节点一致）；
			// failOpen=false：D1 故障时拒绝解锁，避免暴力破解防护失效。
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
		// 公开响应必须剔除加密相册的密码与照片列表，避免未认证访客读取；
		// 判锁以 D1 密码存在与否为准（对齐 unlockGalleryAlbum/gallery-files），
		// 避免 R2 frontmatter.encrypted 与 D1 不同步时公开 GET 泄露照片。
		// 且相册详情含敏感信息，一律私有不缓存（no-store）
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

	// 图床拉图：POST /api/gallery/{slug}/imgbed/photos/
	// 服务端用全局图床配置（端点+密钥）调图床 API 列目录（dir=slug）→ 拼公开直链 → 写入 frontmatter.photos
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
					const { setAlbumPhotos } = await import(
						"../../../../server/gallery/service"
					);
					const cfg = await getImgbedConfig(cfEnv);
					if (!cfg)
						return badRequest(
							"未配置图床 API（请先在站点设置 → 相册 配置端点与密钥）",
						);
					const photos = await fetchImgbedPhotos(cfg.endpoint, cfg.token, slug);
					await setAlbumPhotos(cfEnv, slug, photos);
					return json({ ok: true, count: photos.length, photos });
				} catch (error) {
					return fromServiceError(error);
				}
			},
		);
	}

	// 解锁限流：防暴力破解相册密码（D1 持久化）；failOpen=false 避免 D1 故障时防护失效
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

		// 相册密码管理（动态博客方式，存 D1）：PUT /api/gallery/{slug}/password/
		if (segments[1] === "password") {
			if (!slug || !isValidGallerySlug(slug))
				return badRequest("相册 slug 格式无效");
			const body = (await request.json().catch(() => ({}))) as {
				password?: string;
			};
			const pwd = String(body.password || "").trim();
			// 同步 R2 frontmatter 的 encrypted 标记，使「是否上锁」与 D1 密码存在与否一致
			await setAlbumPassword(cfEnv, slug, pwd);
			await setAlbumEncryptedFlag(cfEnv, slug, !!pwd);
			return json({ ok: true, hasPassword: !!pwd });
		}

		// WebDAV 源配置（存 D1）：PUT /api/gallery/{slug}/webdav/，body { url, username? }
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
		// 仅清除相册密码（不删除相册）：DELETE /api/gallery/{slug}/password/
		if (segments[1] === "password") {
			await deleteAlbumPassword(cfEnv, slug);
			// 同步清除 R2 frontmatter 的 encrypted 标记
			await setAlbumEncryptedFlag(cfEnv, slug, false);
			return json({ ok: true, hasPassword: false });
		}

		// 清除 WebDAV 源配置并切回本地源：DELETE /api/gallery/{slug}/webdav/
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

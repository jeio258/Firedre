import type { APIRoute } from "astro";
import { verifyAdminRequest } from "../../../../server/auth/adminSession";
import { isValidGallerySlug } from "../../../../server/gallery/constants";
import {
	sanitizeGalleryAlbumForPublic,
} from "../../../../server/gallery/sanitize";
import {
	deleteGalleryAlbum,
	getGalleryAlbum,
	getGalleryHub,
	unlockGalleryAlbum,
	upsertGalleryAlbum,
	upsertGalleryHub,
} from "../../../../server/gallery/service";
import {
	deleteAlbumPassword,
	getAlbumPassword,
	setAlbumPassword,
} from "../../../../server/gallery/password";
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

		if (segments[1] === "unlock" && request.method === "GET") {
			// 解锁限流：防暴力破解相册密码（D1 持久化，跨边缘节点一致）；
			// failOpen=false：D1 故障时拒绝解锁，避免暴力破解防护失效。
			return withRateLimit(
				cfEnv,
				request,
				{ windowMs: 60_000, maxRequests: 10, failOpen: false },
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
		// 且相册详情含敏感信息，一律私有不缓存（no-store）
		const payload = isAdmin ? album : sanitizeGalleryAlbumForPublic(album);
		return json(payload, 200, "private");
	} catch (error) {
		return fromServiceError(error);
	}
};

export const POST: APIRoute = async ({ params, request }) => {
	const segments = (params.path || "").split("/").filter(Boolean);
	const slug = segments[0];
	if (!slug || segments[1] !== "unlock" || !isValidGallerySlug(slug))
		return notFound();

	// 解锁限流：防暴力破解相册密码（D1 持久化）；failOpen=false 避免 D1 故障时防护失效
	return withRateLimit(
		cfEnv,
		request,
		{ windowMs: 60_000, maxRequests: 10, failOpen: false },
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
			await setAlbumPassword(cfEnv, slug, String(body.password || ""));
			return json({ ok: true, hasPassword: !!String(body.password || "").trim() });
		}

		if (segments.length === 0) {
			const body = await request.text();
			if (!body.trim()) return badRequest("内容不能为空");
			const result = await upsertGalleryHub(cfEnv, body);
			return json({ ok: true, ...result });
		}

		if (!slug || !isValidGallerySlug(slug)) return badRequest("相册 slug 格式无效");
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
			return json({ ok: true, hasPassword: false });
		}

		const result = await deleteGalleryAlbum(cfEnv, slug);
		return json({ ok: true, ...result });
	} catch (error) {
		return fromServiceError(error);
	}
};

export const ALL: APIRoute = async () => methodNotAllowed();

import type { APIRoute } from "astro";
import { verifyAdminRequest } from "../../../../server/auth/adminSession";
import {
	createSiteLink,
	deleteSiteLink,
	getSiteLink,
	listEnabledSiteLinks,
	listSiteLinks,
	updateSiteLink,
} from "../../../../server/siteLinks/service";
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

// GET /api/site-links/  - 链接列表（后台含全部，前台仅启用）
export const GET: APIRoute = async ({ params, request }) => {
	const segments = (params.path || "").split("/").filter(Boolean);
	const isAdmin = await verifyAdminRequest(request, cfEnv);

	try {
		if (segments.length === 0) {
			const items = isAdmin
				? await listSiteLinks(cfEnv)
				: await listEnabledSiteLinks(cfEnv);
			return json(
				{ items: items.map(toView) },
				200,
				isAdmin ? "private" : "list",
			);
		}

		// 单条：/api/site-links/{id}/
		if (segments.length === 1) {
			const id = Number(segments[0]);
			if (!Number.isInteger(id) || id <= 0) return badRequest("无效的链接ID");
			const link = await getSiteLink(cfEnv, id);
			if (!link || (!isAdmin && link.enabled !== true)) return notFound("链接不存在");
			return json(toView(link), 200, isAdmin ? "private" : "default");
		}

		return notFound("路径无效");
	} catch (error) {
		return fromServiceError(error);
	}
};

// POST /api/site-links/  - 新增链接
export const POST: APIRoute = async ({ request }) => {
	const isAdmin = await verifyAdminRequest(request, cfEnv);
	if (!isAdmin) return unauthorized();

	try {
		const body = await request.json().catch(() => null);
		if (!body || typeof body !== "object") return badRequest("请求体无效");
		const link = await createSiteLink(cfEnv, body as never);
		return json({ ok: true, item: toView(link) }, 200, "private");
	} catch (error) {
		return fromServiceError(error);
	}
};

// PUT /api/site-links/{id}/  - 修改链接
export const PUT: APIRoute = async ({ params, request }) => {
	const segments = (params.path || "").split("/").filter(Boolean);
	const isAdmin = await verifyAdminRequest(request, cfEnv);
	if (!isAdmin) return unauthorized();

	try {
		if (segments.length !== 1) return notFound("路径无效");
		const id = Number(segments[0]);
		if (!Number.isInteger(id) || id <= 0) return badRequest("无效的链接ID");
		const body = await request.json().catch(() => null);
		if (!body || typeof body !== "object") return badRequest("请求体无效");
		const link = await updateSiteLink(cfEnv, id, body as never);
		return json({ ok: true, item: toView(link) }, 200, "private");
	} catch (error) {
		return fromServiceError(error);
	}
};

// DELETE /api/site-links/{id}/  - 删除链接
export const DELETE: APIRoute = async ({ params, request }) => {
	const segments = (params.path || "").split("/").filter(Boolean);
	const isAdmin = await verifyAdminRequest(request, cfEnv);
	if (!isAdmin) return unauthorized();

	try {
		if (segments.length !== 1) return notFound("路径无效");
		const id = Number(segments[0]);
		if (!Number.isInteger(id) || id <= 0) return badRequest("无效的链接ID");
		const ok = await deleteSiteLink(cfEnv, id);
		if (!ok) return notFound("链接不存在");
		return json({ ok: true }, 200, "private");
	} catch (error) {
		return fromServiceError(error);
	}
};

export const ALL: APIRoute = async () => methodNotAllowed();

function toView(row: {
	id: number;
	name: string;
	url: string;
	icon: string;
	location: "navbar" | "footer" | "profile" | "sponsor";
	kind: "link" | "qr";
	enabled: boolean;
}) {
	return {
		id: row.id,
		name: row.name,
		url: row.url,
		icon: row.icon || "",
		location: row.location,
		kind: row.kind || "link",
		enabled: row.enabled === true,
	};
}

import type { APIRoute } from "astro";
import { verifyAdminRequest } from "../../../../server/auth/adminSession";
import {
	createFriend,
	deleteFriend,
	getFriend,
	listEnabledFriends,
	listFriends,
	updateFriend,
} from "../../../../server/friends/service";
import {
	badRequest,
	cfEnv,
	fromServiceError,
	json,
	methodNotAllowed,
	notFound,
	serverError,
	unauthorized,
} from "../../../lib/api";

export const prerender = false;

// GET /api/friends/  - 友链列表（后台含全部，前台展示仅启用）
export const GET: APIRoute = async ({ params, request }) => {
	const segments = (params.path || "").split("/").filter(Boolean);
	const isAdmin = await verifyAdminRequest(request, cfEnv);

	try {
		if (segments.length === 0) {
			// 公开只显示启用的友链；管理员可见全部（含停用）
			const items = isAdmin
				? await listFriends(cfEnv)
				: await listEnabledFriends(cfEnv);
			return json(
				{ items: items.map(toView) },
				200,
				isAdmin ? "private" : "list",
			);
		}

		// 单条：/api/friends/{id}/
		if (segments.length === 1) {
			const id = Number(segments[0]);
			if (!Number.isInteger(id) || id <= 0) return badRequest("无效的友链ID");
			const friend = await getFriend(cfEnv, id);
			if (!friend) return notFound("友链不存在");
			return json(toView(friend), 200, isAdmin ? "private" : "default");
		}

		return notFound("路径无效");
	} catch (error) {
		return fromServiceError(error);
	}
};

// POST /api/friends/  - 新增友链
export const POST: APIRoute = async ({ request }) => {
	const isAdmin = await verifyAdminRequest(request, cfEnv);
	if (!isAdmin) return unauthorized();

	try {
		const body = await request.json().catch(() => null);
		if (!body || typeof body !== "object") return badRequest("请求体无效");
		const friend = await createFriend(cfEnv, body as never);
		if (!friend) return serverError("创建友链失败");
		return json({ ok: true, item: toView(friend) }, 200, "private");
	} catch (error) {
		return fromServiceError(error);
	}
};

// PUT /api/friends/{id}/  - 修改友链
export const PUT: APIRoute = async ({ params, request }) => {
	const segments = (params.path || "").split("/").filter(Boolean);
	const isAdmin = await verifyAdminRequest(request, cfEnv);
	if (!isAdmin) return unauthorized();

	try {
		if (segments.length !== 1) return notFound("路径无效");
		const id = Number(segments[0]);
		if (!Number.isInteger(id) || id <= 0) return badRequest("无效的友链ID");

		const body = await request.json().catch(() => null);
		if (!body || typeof body !== "object") return badRequest("请求体无效");

		const friend = await updateFriend(cfEnv, id, body as never);
		if (!friend) return notFound("友链不存在");
		return json({ ok: true, item: toView(friend) }, 200, "private");
	} catch (error) {
		return fromServiceError(error);
	}
};

// DELETE /api/friends/{id}/  - 删除友链
export const DELETE: APIRoute = async ({ params, request }) => {
	const segments = (params.path || "").split("/").filter(Boolean);
	const isAdmin = await verifyAdminRequest(request, cfEnv);
	if (!isAdmin) return unauthorized();

	try {
		if (segments.length !== 1) return notFound("路径无效");
		const id = Number(segments[0]);
		if (!Number.isInteger(id) || id <= 0) return badRequest("无效的友链ID");

		const ok = await deleteFriend(cfEnv, id);
		if (!ok) return notFound("友链不存在");
		return json({ ok: true }, 200, "private");
	} catch (error) {
		return fromServiceError(error);
	}
};

export const ALL: APIRoute = async () => methodNotAllowed();

function toView(row: {
	id: number;
	title: string;
	imgurl: string;
	desc: string;
	siteurl: string;
	tags: string;
	weight: number;
	enabled: number;
}) {
	return {
		id: row.id,
		title: row.title,
		imgurl: row.imgurl,
		desc: row.desc || "",
		siteurl: row.siteurl,
		tags: (row.tags || "").split(",").map((t) => t.trim()).filter(Boolean),
		weight: Number(row.weight),
		enabled: row.enabled === 1,
	};
}

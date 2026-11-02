// 权限自助 API：我的权限 / 提交申请 / 管理员撤销授权
// GET  /api/perms/me/       当前用户权限快照 + 申请记录 + 权限点目录
// POST /api/perms/request/  { perm, note } 提交权限申请
// POST /api/perms/revoke/   { userId, perm } 管理员撤销已授予的权限点

import {
	isKnownPerm,
	PERM_CATALOG,
	requestPerm,
	resolveBackendActor,
	revokePerm,
	userPermSnapshot,
} from "@server/auth/perms";
import {
	getAuthUser,
	isSameOriginRequest,
	originForbiddenResponse,
} from "@server/auth/userSession";
import type { APIRoute } from "astro";
import {
	cfEnv,
	json,
	methodNotAllowed,
	serverError,
	unauthorized,
} from "../../../lib/api";
import { pathSegments } from "../../../lib/routePath";

export const prerender = false;

export const GET: APIRoute = async ({ params, request }) => {
	const action = pathSegments(params)[0] || "";
	try {
		if (action === "me") {
			const user = await getAuthUser(request, cfEnv);
			// 未登录也返回 200：个人中心的权限面板据此显示「登录后可申请」
			if (!user) {
				return json(
					{
						authenticated: false,
						isAdmin: false,
						perms: [],
						requests: [],
						catalog: PERM_CATALOG,
					},
					200,
					"private",
				);
			}
			const snapshot = await userPermSnapshot(cfEnv.DB, user);
			return json({ authenticated: true, ...snapshot }, 200, "private");
		}
		return json({ message: "Not found" }, 404);
	} catch (error) {
		return serverError(error);
	}
};

export const POST: APIRoute = async ({ params, request }) => {
	const action = pathSegments(params)[0] || "";

	if (!isSameOriginRequest(request)) return originForbiddenResponse();

	try {
		if (action === "request") {
			const user = await getAuthUser(request, cfEnv);
			if (!user) return unauthorized();
			if (user.role === "admin")
				return json({ message: "管理员已拥有全部权限" }, 400);

			const body = (await request.json().catch(() => null)) as {
				perm?: string;
				note?: string;
			} | null;
			const perm = String(body?.perm || "");
			if (!isKnownPerm(perm)) return json({ message: "未知权限点" }, 400);

			const out = await requestPerm(
				cfEnv.DB,
				user.id,
				perm,
				String(body?.note || ""),
			);
			if (!out.ok) return json({ message: out.message }, 400);
			return json({ ok: true, request: out.request }, 200, "private");
		}

		if (action === "revoke") {
			const actor = await resolveBackendActor(request, cfEnv);
			if (!actor) return unauthorized();
			if (!actor.isAdmin) return json({ message: "需要管理员权限" }, 403);

			const body = (await request.json().catch(() => null)) as {
				userId?: string;
				perm?: string;
			} | null;
			const userId = String(body?.userId || "");
			const perm = String(body?.perm || "");
			if (!userId) return json({ message: "缺少用户 id" }, 400);
			if (!isKnownPerm(perm)) return json({ message: "未知权限点" }, 400);

			await revokePerm(cfEnv.DB, userId, perm);
			return json({ ok: true }, 200, "private");
		}

		return json({ message: "Not found" }, 404);
	} catch (error) {
		return serverError(error);
	}
};

export const ALL: APIRoute = async () => methodNotAllowed(["GET", "POST"]);

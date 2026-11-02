// 后台：权限申请列表（仅管理员可见）

import { listRequestsForAdmin, resolveBackendActor } from "@server/auth/perms";
import type { APIRoute } from "astro";
import { cfEnv, json, methodNotAllowed, unauthorized } from "../../../lib/api";

export const prerender = false;

export const GET: APIRoute = async ({ request, url }) => {
	const actor = await resolveBackendActor(request, cfEnv);
	if (!actor) return unauthorized();
	// 审批权限仅管理员持有
	if (!actor.isAdmin) return json({ message: "需要管理员权限" }, 403);

	const result = await listRequestsForAdmin(cfEnv.DB, {
		status: url.searchParams.get("status") || "pending",
		page: Number(url.searchParams.get("page") || 1),
		pageSize: Number(url.searchParams.get("pageSize") || 20),
	});
	return json(result, 200, "private");
};

export const ALL: APIRoute = async () => methodNotAllowed(["GET"]);

// 后台：当前访问者身份与能力（管理端界面据此渲染菜单；无权限则 canAccess=false）

import { PERM_CATALOG, resolveBackendActor } from "@server/auth/perms";
import type { APIRoute } from "astro";
import { cfEnv, json } from "../../../lib/api";

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
	const actor = await resolveBackendActor(request, cfEnv);
	if (!actor) {
		return json(
			{ authenticated: false, canAccess: false, isAdmin: false, perms: [] },
			200,
			"private",
		);
	}

	const permLabels = actor.isAdmin
		? ["全部权限（管理员）"]
		: actor.perms.map((p) => PERM_CATALOG.find((c) => c.id === p)?.label ?? p);

	return json(
		{
			authenticated: true,
			canAccess: true,
			isAdmin: actor.isAdmin,
			username: actor.username,
			perms: actor.perms,
			permLabels,
			viaAdminSession: actor.viaAdminSession,
			userId: actor.user?.id ?? null,
			email: actor.user?.email ?? null,
			avatar: actor.user?.avatar ?? "",
		},
		200,
		"private",
	);
};

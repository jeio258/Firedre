// 后台：审批权限申请（approve 通过后写入 user_permissions）

import {
	type ReviewAction,
	resolveBackendActor,
	reviewPermRequest,
} from "@server/auth/perms";
import {
	isSameOriginRequest,
	originForbiddenResponse,
} from "@server/auth/userSession";
import type { APIRoute } from "astro";
import {
	cfEnv,
	fromServiceError,
	json,
	methodNotAllowed,
	unauthorized,
} from "../../../lib/api";

export const prerender = false;

const ACTIONS: ReviewAction[] = ["approve", "deny"];

export const POST: APIRoute = async ({ request }) => {
	if (!isSameOriginRequest(request)) return originForbiddenResponse();

	try {
		const actor = await resolveBackendActor(request, cfEnv);
		if (!actor) return unauthorized();
		if (!actor.isAdmin) return json({ message: "需要管理员权限" }, 403);

		const body = (await request.json().catch(() => null)) as {
			id?: string;
			action?: string;
		} | null;
		if (!body?.id) return json({ message: "缺少申请 id" }, 400);
		if (!body.action || !ACTIONS.includes(body.action as ReviewAction))
			return json({ message: "未知的审批动作" }, 400);

		const out = await reviewPermRequest(
			cfEnv.DB,
			String(body.id),
			body.action as ReviewAction,
			actor.username || "admin",
		);
		if (!out.ok) return json({ message: out.message }, 400);
		return json(
			{ ok: true, action: body.action, perm: out.perm },
			200,
			"private",
		);
	} catch (error) {
		return fromServiceError(error);
	}
};

export const ALL: APIRoute = async () => methodNotAllowed(["POST"]);

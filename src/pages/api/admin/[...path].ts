import { collectAdminStats } from "@server/admin/stats";
import { verifyAdminRequest } from "@server/auth/adminSession";
import { validatePassword } from "@server/auth/register";
import {
	buildUserSessionCookie,
	createSessionToken,
	getAuthUser,
	hashPassword,
	sessionMaxAge,
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

function jsonWithHeaders(
	data: unknown,
	status = 200,
	extraHeaders: Record<string, string> = {},
) {
	return new Response(JSON.stringify(data), {
		status,
		headers: {
			"Content-Type": "application/json; charset=utf-8",
			"Cache-Control": "no-store",
			...extraHeaders,
		},
	});
}

// 后台身份统一走前台会话（users.role='admin'），不再有独立的后台登录/初始化端点
export const POST: APIRoute = async ({ params, request }) => {
	const segments = pathSegments(params);
	const action = segments[0] || "";
	const secure = new URL(request.url).protocol === "https:";

	try {
		if (action === "users") {
			const sub = segments[1] || "";
			if (sub !== "password") return json({ message: "未知操作" }, 400);

			const me = await getAuthUser(request, cfEnv);
			if (!me || me.role !== "admin") return unauthorized();

			const body = (await request.json().catch(() => ({}))) as {
				password?: string;
			};
			const newPassword = String(body.password || "");
			const pwErr = validatePassword(newPassword);
			if (pwErr) return json({ message: pwErr }, 400);

			await cfEnv.DB.prepare(
				"UPDATE users SET password = ?, updated_at = datetime('now') WHERE id = ?",
			)
				.bind(await hashPassword(newPassword), me.id)
				.run();

			// 会话 token 携带密码指纹，改密后旧 token 立即失效；此处重签避免把自己踢下线
			const token = await createSessionToken(me.id, me.role, cfEnv);
			return jsonWithHeaders({ ok: true }, 200, {
				"Set-Cookie": buildUserSessionCookie(
					token,
					secure,
					true,
					sessionMaxAge(me.role),
				),
			});
		}

		return json({ message: "Not found" }, 404);
	} catch (error) {
		return serverError(error);
	}
};

export const GET: APIRoute = async ({ params, request }) => {
	const segments = pathSegments(params);
	const action = segments[0] || "";

	if (action !== "me" && action !== "stats")
		return json({ message: "Not found" }, 404);

	try {
		const isAdmin = await verifyAdminRequest(request, cfEnv);
		// 未认证返回 401（前端 AdminApp 已按 401 处理）；语义规范、便于监控识别
		if (!isAdmin) return json({ authenticated: false }, 401, "private");

		if (action === "me") {
			const me = await getAuthUser(request, cfEnv);
			return json(
				{ authenticated: true, username: me?.name || me?.email || "" },
				200,
				"private",
			);
		}

		// action === "stats"：后台仪表盘聚合
		const stats = await collectAdminStats(cfEnv.DB);
		return jsonWithHeaders(stats);
	} catch (error) {
		// 未认证已在上方显式返回 401；此处均为非预期错误 → 500，不得伪装成"未认证"
		return serverError(error);
	}
};

export const ALL: APIRoute = async () => methodNotAllowed(["GET", "POST"]);

import type { APIRoute } from "astro";
import {
	ADMIN_SESSION_COOKIE,
	buildClearSessionCookie,
	buildSessionCookie,
	createSessionToken,
	getCookieValue,
	getSessionUser,
	resolveAdminEnv,
	verifyAdminRequest,
} from "../../../../server/auth/adminSession";
import {
	authenticateAdmin,
	createAdminUser,
	hasAdminUser,
	updateAdminUserPassword,
} from "../../../../server/auth/adminUser";
import {
	createD1LoginRateLimit,
	formatLoginRateLimitMessage,
	getRequestClientIp,
} from "../../../../server/auth/loginRateLimit";
import {
	cfEnv,
	json,
	methodNotAllowed,
	serverError,
	unauthorized,
} from "../../../lib/api";

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

export const POST: APIRoute = async ({ params, request }) => {
	const segments = (params.path || "").split("/").filter(Boolean);
	const action = segments[0] || "";
	const adminEnv = resolveAdminEnv(cfEnv);
	const secure = new URL(request.url).protocol === "https:";

	try {
		// 首次创建唯一管理员（注册）：仅当系统尚无管理员时允许。
		if (action === "setup") {
			const body = (await request.json()) as {
				username?: string;
				password?: string;
			};
			const username = String(body.username || "").trim();
			const password = String(body.password || "");

			if (!username || !password)
				return json({ message: "用户名与密码不能为空" }, 400);
			if (password.length < 8)
				return json({ message: "密码至少 8 位" }, 400);

			if (await hasAdminUser(cfEnv.DB))
				return json({ message: "管理员已存在，无法重复创建" }, 409);

			const result = await createAdminUser(cfEnv.DB, username, password);
			if (!result.ok)
				return json({ message: "创建失败或用户名已存在" }, 400);

			// 创建成功后直接登录
			const token = await createSessionToken(username, adminEnv);
			return jsonWithHeaders({ ok: true, username }, 200, {
				"Set-Cookie": buildSessionCookie(token, secure),
			});
		}

		if (action === "login") {
			const body = (await request.json()) as {
				username?: string;
				password?: string;
			};
			const username = String(body.username || "").trim();
			const password = String(body.password || "");
			const clientIp = getRequestClientIp(request);
			const rateLimit = createD1LoginRateLimit(cfEnv.DB);

			const limit = await rateLimit.check(clientIp);
			if (!limit.allowed) {
				return json(
					{ message: formatLoginRateLimitMessage(limit.retryAfterSec || 60) },
					429,
				);
			}

			// 使用 D1 唯一管理员验证（不再依赖 Secrets）
			const isValid = await authenticateAdmin(
				cfEnv,
				cfEnv.DB,
				username,
				password,
			);
			if (!isValid) {
				await rateLimit.recordFailure(clientIp);
				return json({ message: "账号或密码错误" }, 401);
			}

			await rateLimit.clear(clientIp);
			const token = await createSessionToken(username, adminEnv);
			return jsonWithHeaders({ ok: true, username }, 200, {
				"Set-Cookie": buildSessionCookie(token, secure),
			});
		}

		if (action === "logout") {
			return jsonWithHeaders({ ok: true }, 200, {
				"Set-Cookie": buildClearSessionCookie(secure),
			});
		}

		if (action === "users") {
			const isAdmin = await verifyAdminRequest(request, cfEnv);
			if (!isAdmin) return unauthorized();

			const sub = segments[1] || "";
			if (sub !== "password") return json({ message: "未知操作" }, 400);

			const body = (await request.json().catch(() => ({}))) as {
				username?: string;
				password?: string;
			};
			const target = String(body.username || "").trim();
			if (!target || !body.password)
				return json({ message: "用户名与密码不能为空" }, 400);

			const ok = await updateAdminUserPassword(
				cfEnv.DB,
				target,
				body.password,
			);
			if (!ok) return json({ message: "用户不存在" }, 404);
			return jsonWithHeaders({ ok: true });
		}

		return json({ message: "Not found" }, 404);
	} catch (error) {
		return serverError(error);
	}
};

export const GET: APIRoute = async ({ params, request }) => {
	const segments = (params.path || "").split("/").filter(Boolean);
	const action = segments[0] || "";

	// 初始化状态：公开查询，供登录页/初始化页判断是否需创建管理员
	if (action === "setup-status") {
		return jsonWithHeaders({ setup: !(await hasAdminUser(cfEnv.DB)) });
	}

	if (action !== "me") return json({ message: "Not found" }, 404);

	try {
		const adminEnv = resolveAdminEnv(cfEnv);

		const isAdmin = await verifyAdminRequest(request, cfEnv);
		if (!isAdmin) return json({ authenticated: false }, 200, "private");

		const token = getCookieValue(
			request.headers.get("Cookie"),
			ADMIN_SESSION_COOKIE,
		);
		const username = token ? await getSessionUser(token, adminEnv) : null;
		return json({ authenticated: true, username: username || "" }, 200, "private");
	} catch (error) {

		return json({ authenticated: false }, 200, "private");
	}
};

export const ALL: APIRoute = async () => methodNotAllowed();

import type { APIRoute } from "astro";
import {
	ADMIN_SESSION_COOKIE,
	buildClearSessionCookie,
	buildSessionCookie,
	createSessionToken,
	getCookieValue,
	getSessionUser,
	isAdminLoginConfigured,
	resolveAdminEnv,
	verifyAdminRequest,
} from "../../../../server/auth/adminSession";
import {
	authenticateAdmin,
	createAdminUser,
	deleteAdminUser,
	listAdminUsers,
	setAdminUserEnabled,
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
		if (action === "login") {
			const body = (await request.json()) as {
				username?: string;
				password?: string;
			};
			const username = String(body.username || "").trim();
			const password = String(body.password || "");
			const clientIp = getRequestClientIp(request);
			const rateLimit = createD1LoginRateLimit(cfEnv.DB);

			if (!isAdminLoginConfigured(adminEnv)) {
				// 凭据权威已迁移到 D1：即使 Secrets 未配置，只要 D1 有用户即可登录。
				const d1Users = await listAdminUsers(cfEnv.DB);
				if (d1Users.length === 0)
					return json(
						{
							message:
								"管理员登录未配置，请在环境变量中设置 ADMIN_USERNAME 与 ADMIN_PASSWORD，或在后台创建首个用户",
						},
						503,
					);
			}

			const limit = await rateLimit.check(clientIp);
			if (!limit.allowed) {
				return json(
					{ message: formatLoginRateLimitMessage(limit.retryAfterSec || 60) },
					429,
				);
			}

			// 使用异步密码验证（D1 优先 + Secrets 兜底 + 平滑迁移）
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

		// 后台用户管理（仅已登录管理员）：POST /api/admin/users/list|create|password|enabled|delete
		if (action === "users") {
			const isAdmin = await verifyAdminRequest(request, cfEnv);
			if (!isAdmin) return unauthorized();

			const sub = segments[1] || "";
			const body = (await request.json().catch(() => ({}))) as {
				username?: string;
				password?: string;
				enabled?: boolean;
			};
			const target = String(body.username || "").trim();

			switch (sub) {
				case "list": {
					const users = await listAdminUsers(cfEnv.DB);
					return jsonWithHeaders({ ok: true, users });
				}
				case "create": {
					if (!target || !body.password)
						return json({ message: "用户名与密码不能为空" }, 400);
					const result = await createAdminUser(cfEnv.DB, target, body.password);
					if (!result.ok && result.conflict)
						return json({ message: "用户名已存在" }, 409);
					if (!result.ok) return json({ message: "创建失败" }, 400);
					return jsonWithHeaders({ ok: true });
				}
				case "password": {
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
				case "enabled": {
					if (!target) return json({ message: "用户名不能为空" }, 400);
					const ok = await setAdminUserEnabled(
						cfEnv.DB,
						target,
						body.enabled !== false,
					);
					if (!ok) return json({ message: "用户不存在" }, 404);
					return jsonWithHeaders({ ok: true });
				}
				case "delete": {
					if (!target) return json({ message: "用户名不能为空" }, 400);
					const ok = await deleteAdminUser(cfEnv.DB, target);
					if (!ok) return json({ message: "用户不存在" }, 404);
					return jsonWithHeaders({ ok: true });
				}
				default:
					return json({ message: "未知操作" }, 400);
			}
		}

		return json({ message: "Not found" }, 404);
	} catch (error) {
		return serverError(error);
	}
};

export const GET: APIRoute = async ({ params, request }) => {
	const segments = (params.path || "").split("/").filter(Boolean);
	const action = segments[0] || "";

	if (action !== "me") return json({ message: "Not found" }, 404);

	try {
		const adminEnv = resolveAdminEnv(cfEnv);
		const isAdmin = await verifyAdminRequest(request, cfEnv);
		if (isAdmin) {
			const bearer = request.headers.get("Authorization") || "";
			if (bearer.startsWith("Bearer "))
				return json({ authenticated: true, username: "token" }, 200, "private");
		}

		const token = getCookieValue(
			request.headers.get("Cookie"),
			ADMIN_SESSION_COOKIE,
		);
		const username = token ? await getSessionUser(token, adminEnv) : null;
		// 会话状态响应必须 no-store（"private" 模式）：登录前的 authenticated:false
		// 若被浏览器缓存（默认模式 public, max-age=60），登录后 60s 内 me/ 全部命中
		// 陈旧 false → 表现为"登录失效/切换菜单自动登出"。
		if (!username) return json({ authenticated: false }, 200, "private");

		return json({ authenticated: true, username }, 200, "private");
	} catch (error) {
		// 配置缺失（如 SESSION_SECRET 未设）时校验会抛异常；统一降级为未认证，避免裸 500
		return json({ authenticated: false }, 200, "private");
	}
};

export const ALL: APIRoute = async () => methodNotAllowed();

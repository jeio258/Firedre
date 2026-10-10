import { collectAdminStats } from "@server/admin/stats";
import {
	ADMIN_SESSION_COOKIE,
	buildClearSessionCookie,
	buildSessionCookie,
	createSessionTokenForUser,
	getAuthenticatedAdminUsername,
	getCookieValue,
	getSessionUser,
	resolveAdminEnv,
	verifyAdminRequest,
} from "@server/auth/adminSession";
import {
	authenticateAdmin,
	createAdminUser,
	hasAdminUser,
	updateAdminUserPassword,
} from "@server/auth/adminUser";
import {
	createD1LoginRateLimit,
	formatLoginRateLimitMessage,
	getRequestClientIp,
} from "@server/auth/loginRateLimit";
import { withRateLimit } from "@server/utils/rateLimiter";
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

export const POST: APIRoute = async ({ params, request }) => {
	const segments = pathSegments(params);
	const action = segments[0] || "";
	const adminEnv = resolveAdminEnv(cfEnv);
	const secure = new URL(request.url).protocol === "https:";

	try {
		// 首次创建唯一管理员（注册）：仅当系统尚无管理员时允许。
		if (action === "setup") {
			return withRateLimit(
				cfEnv,
				request,
				{
					windowMs: 60_000,
					maxRequests: 5,
					scope: "admin-setup",
					failOpen: false,
				},
				async () => {
					const body = (await request.json().catch(() => null)) as {
						username?: string;
						password?: string;
					} | null;
					if (!body) return json({ message: "请求体格式错误" }, 400);
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
					const token = await createSessionTokenForUser(
						cfEnv.DB,
						username,
						adminEnv,
					);
					return jsonWithHeaders({ ok: true, username }, 200, {
						"Set-Cookie": buildSessionCookie(token, secure),
					});
				},
			);
		}

		if (action === "login") {
			// IP 级 QPS 限流：压平突发，降低 bcrypt（密码校验）资源消耗面
			return withRateLimit(
				cfEnv,
				request,
				{
					windowMs: 60_000,
					maxRequests: 20,
					scope: "admin-login",
					failOpen: false,
				},
				async () => {
					const body = (await request.json().catch(() => null)) as {
						username?: string;
						password?: string;
					} | null;
					if (!body) return json({ message: "请求体格式错误" }, 400);
					const username = String(body.username || "").trim();
					const password = String(body.password || "");
					const clientIp = getRequestClientIp(request);
					const rateLimit = createD1LoginRateLimit(cfEnv.DB);

					const limit = await rateLimit.check(clientIp);
					if (!limit.allowed) {
						const sec = limit.retryAfterSec || 60;
						return jsonWithHeaders(
							{ message: formatLoginRateLimitMessage(sec) },
							429,
							{ "Retry-After": String(sec) },
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
						// #1 原子计数：达到阈值的那次失败即返回 429（并发突发不再只计数不锁定）
						const fail = await rateLimit.recordFailure(clientIp);
						if (fail.locked) {
							const sec = fail.retryAfterSec || 60;
							return jsonWithHeaders(
								{ message: formatLoginRateLimitMessage(sec) },
								429,
								{ "Retry-After": String(sec) },
							);
						}
						return json({ message: "账号或密码错误" }, 401);
					}

					await rateLimit.clear(clientIp);
					const token = await createSessionTokenForUser(
						cfEnv.DB,
						username,
						adminEnv,
					);
					return jsonWithHeaders({ ok: true, username }, 200, {
						"Set-Cookie": buildSessionCookie(token, secure),
					});
				},
			);
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
				password?: string;
			};
			const newPassword = String(body.password || "");
			if (!newPassword) return json({ message: "密码不能为空" }, 400);
			if (newPassword.length < 8)
				return json({ message: "密码至少 8 位" }, 400);

			// 用户名取自已认证会话，不再依赖客户端传入（修复生产环境 username 取不到导致无法改密）
			const token = getCookieValue(
				request.headers.get("Cookie"),
				ADMIN_SESSION_COOKIE,
			);
			const sessionUser = token ? await getSessionUser(token, adminEnv) : null;
			if (!sessionUser) return json({ message: "会话无效，请重新登录" }, 401);

			const ok = await updateAdminUserPassword(
				cfEnv.DB,
				sessionUser,
				newPassword,
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
	const segments = pathSegments(params);
	const action = segments[0] || "";

	// 初始化状态：公开查询，供登录页/初始化页判断是否需创建管理员
	if (action === "setup-status") {
		return jsonWithHeaders({ setup: !(await hasAdminUser(cfEnv.DB)) });
	}

	if (action !== "me" && action !== "stats")
		return json({ message: "Not found" }, 404);

	try {
		const isAdmin = await verifyAdminRequest(request, cfEnv);
		// #5 未认证返回 401（前端 AdminApp 已按 401 处理）；语义规范、便于监控识别
		if (!isAdmin) return json({ authenticated: false }, 401, "private");

		if (action === "me") {
			const username = await getAuthenticatedAdminUsername(request, cfEnv);
			return json(
				{ authenticated: true, username: username || "" },
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

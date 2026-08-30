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
	validateAdminCredentials,
	verifyAdminRequest,
} from "../../../../server/auth/adminSession";
import {
	createD1LoginRateLimit,
	formatLoginRateLimitMessage,
	getRequestClientIp,
} from "../../../../server/auth/loginRateLimit";
import { cfEnv, json, methodNotAllowed, serverError } from "../../../lib/api";

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

			if (!isAdminLoginConfigured(adminEnv))
				return json(
					{
						message:
							"管理员登录未配置，请在环境变量中设置 ADMIN_USERNAME 与 ADMIN_PASSWORD",
					},
					503,
				);

			const limit = await rateLimit.check(clientIp);
			if (!limit.allowed) {
				return json(
					{ message: formatLoginRateLimitMessage(limit.retryAfterSec || 60) },
					429,
				);
			}

			// 使用异步密码验证（支持 bcrypt）
			const isValid = await validateAdminCredentials(
				username,
				password,
				adminEnv,
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

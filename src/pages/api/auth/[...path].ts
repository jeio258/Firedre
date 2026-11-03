// 前台用户认证 API（设计 DESIGN-USER-SYSTEM.md C/D.1/D.4/G.3）
// 路由风格仿 src/pages/api/admin/[...path].ts：每域一个 catch-all，按 action 分发
// OAuth（oauth/<provider>/start|callback，GET 302）已在下方 GET 分支接线，走 server/auth/oauth.ts

import { hasLegacyAdmin, verifyAdminRequest } from "@server/auth/adminSession";
import { getRequestClientIp } from "@server/auth/loginRateLimit";
import {
	handleOauthCallback,
	handleOauthStart,
	isOAuthProvider,
} from "@server/auth/oauth";
import { listUserPerms, PERM_IDS } from "@server/auth/perms";
import {
	bootstrapOwner,
	isValidEmail,
	type RegisterEnv,
	registerUser,
	requestPasswordReset,
	resendVerification,
	resetPassword,
	resolveUserEmail,
	validatePassword,
	verifyTurnstile,
} from "@server/auth/register";
import {
	type AuthUser,
	buildClearUserSessionCookie,
	buildUserSessionCookie,
	createSessionToken,
	getAuthUser,
	hashPassword,
	isSameOriginRequest,
	originForbiddenResponse,
	sessionMaxAge,
	validateProfilePatch,
	verifyPassword,
} from "@server/auth/userSession";
import { describeMailConfig, sendMail } from "@server/mail";
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

/** 站点 origin（验证邮件链接用） */
function siteOriginOf(request: Request): string {
	return new URL(request.url).origin;
}

/** 站点名（邮件主题用），读失败回退 Firedre */
async function siteNameOf(): Promise<string> {
	try {
		const row = await cfEnv.DB.prepare(
			"SELECT value FROM site_settings WHERE key = 'basic'",
		).first<{ value: string }>();
		if (row?.value) {
			const v = JSON.parse(row.value) as { title?: string };
			if (v.title?.trim()) return v.title.trim();
		}
	} catch {
		// 忽略，用默认名
	}
	return "Firedre";
}

/**
 * 邮件通道是否就绪。只看服务端配置，与收件邮箱无关，
 * 因此用它改注册文案不会破坏「注册接口对已存在邮箱返回相同响应」的防枚举约束。
 */
function mailReadiness(): { ready: boolean; missing: string[] } {
	const cfg = describeMailConfig(cfEnv as RegisterEnv);
	return { ready: cfg.missing.length === 0, missing: cfg.missing };
}

async function isRegistrationAllowed(): Promise<boolean> {
	try {
		const row = await cfEnv.DB.prepare(
			"SELECT value FROM site_settings WHERE key = 'basic'",
		).first<{ value: string }>();
		if (!row?.value) return true;
		const v = JSON.parse(row.value) as { allowRegistration?: unknown };
		return v.allowRegistration !== false;
	} catch {
		return true;
	}
}

async function needsSetup(): Promise<boolean> {
	try {
		const row = await cfEnv.DB.prepare("SELECT id FROM users LIMIT 1").first();
		return !row;
	} catch {
		return false;
	}
}

function publicUser(u: AuthUser, extraEmails: string[] = []) {
	return {
		id: u.id,
		email: u.email,
		emails: [u.email, ...extraEmails],
		emailVerified: u.email_verified === 1,
		name: u.name,
		avatar: u.avatar,
		bio: u.bio,
		role: u.role,
		createdAt: u.created_at,
	};
}

// ---------- POST ----------

export const POST: APIRoute = async ({ params, request }) => {
	const segments = pathSegments(params);
	const action = segments[0] || "";
	const registerEnv = cfEnv as RegisterEnv;
	const secure = new URL(request.url).protocol === "https:";

	// 所有写 API 校验 Origin（设计 G.3 CSRF）
	if (!isSameOriginRequest(request)) return originForbiddenResponse();

	try {
		// ── 注册（防枚举：无论邮箱是否已存在，响应完全一致） ──
		if (action === "register") {
			return await withRateLimit(
				cfEnv,
				request,
				{
					windowMs: 60 * 60_000, // 10 次/时/IP（含校验失败；个人博客足够防滥用）
					maxRequests: 10,
					scope: "register",
				},
				async () => {
					const body = (await request.json().catch(() => null)) as {
						email?: string;
						name?: string;
						password?: string;
						turnstileToken?: string;
						legacyPassword?: string;
					} | null;
					if (!body) return json({ message: "请求体格式错误" }, 400);

					const turnstile = await verifyTurnstile(
						registerEnv,
						String(body.turnstileToken || ""),
						getRequestClientIp(request),
						new URL(request.url).hostname,
					);
					if (!turnstile.ok)
						return json(
							{ message: turnstile.message || "人机验证未通过" },
							403,
						);

					const firstUser = !(await cfEnv.DB.prepare(
						"SELECT id FROM users LIMIT 1",
					).first());
					if (firstUser) {
						const boot = await bootstrapOwner(
							cfEnv.DB,
							registerEnv,
							{
								email: String(body.email || ""),
								name: String(body.name || ""),
								password: String(body.password || ""),
								legacyPassword: body.legacyPassword
									? String(body.legacyPassword)
									: undefined,
							},
							siteOriginOf(request),
							await siteNameOf(),
						);
						if (!boot.ok)
							return json(
								{ message: boot.message || "初始化失败", reason: boot.reason },
								400,
							);
						const token = await createSessionToken(boot.userId, "admin", cfEnv);
						return jsonWithHeaders({ ok: true, setup: true }, 200, {
							"Set-Cookie": buildUserSessionCookie(token, secure, true),
						});
					}

					if (!(await isRegistrationAllowed()))
						return json({ message: "本站暂未开放注册" }, 403);

					const outcome = await registerUser(
						cfEnv.DB,
						registerEnv,
						{
							email: String(body.email || ""),
							name: String(body.name || ""),
							password: String(body.password || ""),
						},
						siteOriginOf(request),
						await siteNameOf(),
					);

					if (outcome.kind === "invalid")
						return json({ message: outcome.message }, 400);

					// created 与 duplicate 同响应（防枚举）
					const envTag = registerEnv.ENVIRONMENT?.trim().toLowerCase();
					const exposeVerifyUrl =
						registerEnv.MAIL_DEBUG === "1" ||
						(envTag && envTag !== "prod" && envTag !== "production");
					const mail = mailReadiness();
					if (!mail.ready)
						console.error(
							"[register] 邮件通道未就绪，验证信不会送达:",
							mail.missing.join("、"),
						);
					// 通道配好了也可能被服务端拒信（如 QQ SMTP 535 授权码失效/风控），
					// 这种失败必须如实告诉用户，否则用户等一封永远不来的信
					const mailFailed =
						outcome.kind === "created" && outcome.mailSent === false;
					if (mailFailed)
						console.error(
							"[register] 验证邮件发送失败，账号已创建但投递未成功:",
							body.email,
						);
					return jsonWithHeaders({
						ok: true,
						mailState: !mail.ready
							? "not_ready"
							: mailFailed
								? "failed"
								: "sent",
						message: !mail.ready
							? "注册已提交，但本站邮件服务暂未就绪，验证邮件可能发不出去，请联系站长处理。"
							: mailFailed
								? "账号已创建，但验证邮件投递失败（发信服务器拒绝），请点「重发验证邮件」重试，或联系站长处理。"
								: "注册提交成功！我们已向你的邮箱发送验证链接，请查收并完成验证（24 小时内有效）。",
						...(exposeVerifyUrl &&
						outcome.kind === "created" &&
						outcome.verifyUrl
							? { devVerifyUrl: outcome.verifyUrl }
							: {}),
					});
				},
			);
		}

		// ── 重发验证邮件（3 次/时/IP，统一响应防枚举） ──
		if (action === "resend") {
			return await withRateLimit(
				cfEnv,
				request,
				{
					windowMs: 60 * 60_000,
					maxRequests: 3,
					scope: "verify-resend",
				},
				async () => {
					const body = (await request.json().catch(() => null)) as {
						email?: string;
					} | null;
					if (!body || !String(body.email || "").trim())
						return json({ message: "请输入邮箱" }, 400);

					await resendVerification(
						cfEnv.DB,
						registerEnv,
						String(body.email),
						siteOriginOf(request),
						await siteNameOf(),
					);
					const mail = mailReadiness();
					if (!mail.ready)
						console.error(
							"[resend] 邮件通道未就绪，验证信不会送达:",
							mail.missing.join("、"),
						);
					return jsonWithHeaders({
						ok: true,
						message: mail.ready
							? "如果该邮箱已注册且尚未验证，验证邮件已发送，请查收。"
							: "如果该邮箱已注册且尚未验证，本站邮件服务暂未就绪，验证邮件可能发不出去，请联系站长处理。",
					});
				},
			);
		}

		// ── 登录（允许未验证账号登录；限流与后台 'login' 锁互不干扰） ──
		if (action === "login") {
			return await withRateLimit(
				cfEnv,
				request,
				{
					windowMs: 15 * 60_000, // 8 次/15 分钟/IP
					maxRequests: 8,
					scope: "user-login",
				},
				async () => {
					const body = (await request.json().catch(() => null)) as {
						email?: string;
						password?: string;
						remember?: boolean;
						turnstileToken?: string;
					} | null;
					if (!body) return json({ message: "请求体格式错误" }, 400);

					const turnstile = await verifyTurnstile(
						registerEnv,
						String(body.turnstileToken || ""),
						getRequestClientIp(request),
						new URL(request.url).hostname,
					);
					if (!turnstile.ok)
						return json(
							{ message: turnstile.message || "人机验证未通过" },
							403,
						);

					const email = String(body.email || "")
						.trim()
						.toLowerCase();
					const password = String(body.password || "");
					if (!email || !password)
						return json({ message: "邮箱与密码不能为空" }, 400);

					// 先经别名解析（主邮箱或 user_emails 别名 → user_id），再按 id 取用户
					const resolvedId = await resolveUserEmail(cfEnv.DB, email);
					const user = resolvedId
						? await cfEnv.DB.prepare(
								`SELECT id, email, email_verified, name, avatar, bio, role, banned, created_at, password
             FROM users WHERE id = ?`,
							)
								.bind(resolvedId)
								.first<AuthUser & { password: string }>()
						: null;

					// 统一失败文案（不区分邮箱不存在/密码错误）
					if (!user) return json({ message: "邮箱或密码错误" }, 401);

					// 明文兼容：若该账号的密码是手工写库时填的明文，比对通过后自动升级为 bcrypt 哈希
					const valid = await verifyPassword(
						password,
						user.password,
						async (hash) => {
							await cfEnv.DB.prepare(
								"UPDATE users SET password = ? WHERE id = ?",
							)
								.bind(hash, user.id)
								.run();
						},
					);
					if (!valid) return json({ message: "邮箱或密码错误" }, 401);

					if (user.banned === 1)
						return json({ message: "该账号已被封禁" }, 403);

					const token = await createSessionToken(user.id, user.role, cfEnv);
					const remember = body.remember !== false;
					return jsonWithHeaders(
						{
							ok: true,
							user: publicUser(user),
						},
						200,
						{
							"Set-Cookie": buildUserSessionCookie(
								token,
								secure,
								remember,
								sessionMaxAge(user.role),
							),
						},
					);
				},
			);
		}

		// ── 忘记密码（防枚举：无论邮箱是否存在都返回成功） ──
		if (action === "forgot") {
			return await withRateLimit(
				cfEnv,
				request,
				{ windowMs: 60 * 60_000, maxRequests: 3, scope: "forgot" },
				async () => {
					const body = (await request.json().catch(() => ({}))) as {
						email?: string;
					};
					await requestPasswordReset(
						cfEnv.DB,
						registerEnv,
						String(body.email || ""),
						siteOriginOf(request),
						await siteNameOf(),
					);
					const mail = mailReadiness();
					if (!mail.ready)
						console.error(
							"[forgot] 邮件通道未就绪，重置信不会送达:",
							mail.missing.join("、"),
						);
					return json({
						ok: true,
						message: mail.ready
							? "如果该邮箱已注册，重置邮件已发送"
							: "如果该邮箱已注册，本站邮件服务暂未就绪，重置邮件可能发不出去，请联系站长处理。",
					});
				},
			);
		}

		// ── 重置密码（token 落地后签发会话） ──
		if (action === "reset") {
			return await withRateLimit(
				cfEnv,
				request,
				{ windowMs: 15 * 60_000, maxRequests: 10, scope: "reset" },
				async () => {
					const body = (await request.json().catch(() => ({}))) as {
						token?: string;
						password?: string;
					};
					const result = await resetPassword(
						cfEnv.DB,
						String(body.token || ""),
						String(body.password || ""),
					);
					if (!result.ok)
						return json(
							{
								message:
									result.reason === "expired"
										? "重置链接已失效，请重新申请"
										: "重置链接无效",
							},
							400,
						);
					const user = await cfEnv.DB.prepare(
						"SELECT id, role FROM users WHERE id = ?",
					)
						.bind(result.userId)
						.first<{ id: string; role: string }>();
					if (!user) return json({ message: "用户不存在" }, 400);
					const token = await createSessionToken(user.id, user.role, cfEnv);
					return jsonWithHeaders({ ok: true }, 200, {
						"Set-Cookie": buildUserSessionCookie(token, secure, true),
					});
				},
			);
		}

		if (action === "logout") {
			return jsonWithHeaders({ ok: true }, 200, {
				"Set-Cookie": buildClearUserSessionCookie(secure),
			});
		}

		// ── 邮件通道自检：真发一封，回显配置摘要与失败原文（管理员；注册接口吞结果的缺口靠这里暴露） ──
		if (action === "mail-test") {
			const isAdmin = await verifyAdminRequest(request, cfEnv);
			if (!isAdmin) return unauthorized();

			const body = (await request.json().catch(() => null)) as {
				to?: string;
			} | null;
			const to = String(body?.to || "").trim();
			if (!isValidEmail(to))
				return json({ message: "收件邮箱格式不正确" }, 400);

			const config = describeMailConfig(registerEnv);
			const result = await sendMail(registerEnv, {
				to,
				subject: `邮件通道自检 - ${await siteNameOf()}`,
				html: "<p>这是一封站点后台发出的邮件通道自检信，收到即表示发信通道可用。</p>",
			});
			return json(
				{
					ok: result.ok && !result.skipped,
					skipped: result.skipped ?? false,
					reason: result.reason ?? null,
					error: result.error ?? null,
					config,
				},
				result.ok && !result.skipped ? 200 : 502,
				"private",
			);
		}

		// ── 用户管理：封禁/解封（管理员鉴权；封禁=登录 403 + getAuthUser 拒绝，即时生效） ──
		if (action === "admin-users") {
			const isAdmin = await verifyAdminRequest(request, cfEnv);
			if (!isAdmin) return unauthorized();

			const body = (await request.json().catch(() => null)) as {
				id?: string;
				action?: string;
			} | null;
			if (!body?.id) return json({ message: "缺少用户 id" }, 400);
			if (
				body.action !== "ban" &&
				body.action !== "unban" &&
				body.action !== "delete"
			)
				return json({ message: "未知的用户管理动作" }, 400);

			const exists = await cfEnv.DB.prepare(
				"SELECT id, role FROM users WHERE id = ?",
			)
				.bind(String(body.id))
				.first<{ id: string; role: string }>();
			if (!exists) return json({ message: "用户不存在" }, 404);

			// 封禁防护：role=admin 的账号一律不可封禁。
			// 负负得正的风险很实际——管理员点自己的「封禁」会把自己锁在用户体系后台之外，
			// 且封禁是每请求校验 banned，解封也需要后台权限，容易变成自锁。
			if (exists.role === "admin" && body.action !== "delete") {
				return json({ message: "管理员账号不可封禁，请先调整其角色" }, 403);
			}

			// ── 删除账号：.likes/绑定/权限级联清除，评论按 FK 置空保留为匿名内容 ──
			if (body.action === "delete") {
				const me = await getAuthUser(request, cfEnv);
				if (me?.id === String(body.id))
					return json({ message: "不能删除当前登录的账号" }, 400);
				if (exists.role === "admin")
					return json({ message: "管理员账号不可删除" }, 403);
				await cfEnv.DB.prepare("DELETE FROM users WHERE id = ?")
					.bind(String(body.id))
					.run();
				return json({ ok: true, deleted: true });
			}

			const banned = body.action === "ban" ? 1 : 0;
			await cfEnv.DB.prepare(
				"UPDATE users SET banned = ?, updated_at = datetime('now') WHERE id = ?",
			)
				.bind(banned, String(body.id))
				.run();

			return json({ ok: true, banned });
		}

		// ── 更新个人资料（昵称/头像/bio） ──
		if (action === "profile") {
			const me = await getAuthUser(request, cfEnv);
			if (!me) return json({ message: "请先登录" }, 401);

			const body = (await request.json().catch(() => null)) as {
				name?: string;
				avatar?: string;
				bio?: string;
			} | null;
			if (!body) return json({ message: "请求体格式错误" }, 400);

			const patchErr = validateProfilePatch({
				name: body.name,
				avatar: body.avatar,
				bio: body.bio,
			});
			if (patchErr) return json({ message: patchErr }, 400);

			await cfEnv.DB.prepare(
				`UPDATE users SET name = ?, avatar = ?, bio = ?, updated_at = datetime('now')
         WHERE id = ?`,
			)
				.bind(
					(body.name ?? me.name).trim(),
					String(body.avatar ?? me.avatar).trim(),
					String(body.bio ?? me.bio).trim(),
					me.id,
				)
				.run();

			const updated = await getAuthUser(request, cfEnv);
			return jsonWithHeaders({
				ok: true,
				user: updated ? publicUser(updated) : null,
			});
		}

		// ── 修改密码（需当前密码；无状态会话无法吊销旧 cookie，改密后其余设备最迟 30 天自然过期） ──
		if (action === "password") {
			const me = await getAuthUser(request, cfEnv);
			if (!me) return json({ message: "请先登录" }, 401);

			const body = (await request.json().catch(() => null)) as {
				currentPassword?: string;
				newPassword?: string;
			} | null;
			if (!body) return json({ message: "请求体格式错误" }, 400);

			const current = String(body.currentPassword || "");
			const next = String(body.newPassword || "");
			if (!current || !next)
				return json({ message: "当前密码与新密码不能为空" }, 400);

			const pwErr = validatePassword(next);
			if (pwErr) return json({ message: pwErr }, 400);

			const row = await cfEnv.DB.prepare(
				"SELECT password FROM users WHERE id = ?",
			)
				.bind(me.id)
				.first<{ password: string }>();
			if (!row) return json({ message: "请先登录" }, 401);

			const valid = await verifyPassword(current, row.password);
			if (!valid) return json({ message: "当前密码不正确" }, 403);
			if (current === next)
				return json({ message: "新密码不能与当前密码相同" }, 400);

			await cfEnv.DB.prepare(
				"UPDATE users SET password = ?, updated_at = datetime('now') WHERE id = ?",
			)
				.bind(await hashPassword(next), me.id)
				.run();

			return jsonWithHeaders({ ok: true, message: "密码已更新" });
		}

		// ── OAuth 只走 GET（start/callback），POST 明确拒绝 ──
		if (segments[0] === "oauth") {
			return json({ message: "OAuth 登录仅支持 GET" }, 405);
		}

		return json({ message: "Not found" }, 404);
	} catch (error) {
		return serverError(error);
	}
};

// ---------- GET ----------

export const GET: APIRoute = async ({ params, request }) => {
	const segments = pathSegments(params);
	const action = segments[0] || "";

	try {
		// ── 初始化状态：公开查询，供注册页判断是否进入「初始化站长」模式 ──
		if (action === "setup-status") {
			return json(
				{
					needsSetup: await needsSetup(),
					hasLegacyAdmin: await hasLegacyAdmin(cfEnv.DB),
					allowRegistration: await isRegistrationAllowed(),
				},
				200,
				"private",
			);
		}

		// ── 用户管理：列表（后台面板用，管理员鉴权） ──
		if (action === "admin-users") {
			const isAdmin = await verifyAdminRequest(request, cfEnv);
			if (!isAdmin) return unauthorized();

			const url2 = new URL(request.url);
			const page = Math.max(1, Number(url2.searchParams.get("page") || 1));
			const pageSize = Math.min(
				100,
				Math.max(1, Number(url2.searchParams.get("pageSize") || 20)),
			);
			const q = String(url2.searchParams.get("q") || "").trim();
			const like = `%${q.replace(/([\\%_])/g, "\\$&")}%`;

			const where = q
				? "WHERE email LIKE ? ESCAPE '\\' OR name LIKE ? ESCAPE '\\'"
				: "";
			const params = q ? [like, like] : [];

			const total = await cfEnv.DB.prepare(
				`SELECT count(*) AS n FROM users ${where}`,
			)
				.bind(...params)
				.first<{ n: number }>();

			const { results } = await cfEnv.DB.prepare(
				`SELECT u.id, u.email, u.name, u.avatar, u.email_verified, u.banned, u.role,
			        u.created_at,
			        (SELECT count(*) FROM oauth_accounts o WHERE o.user_id = u.id) AS oauth_count,
			        (SELECT count(*) FROM comments c WHERE c.user_id = u.id AND c.status != 'deleted') AS comment_count
			 FROM users u ${where}
				 ORDER BY u.created_at DESC
				 LIMIT ? OFFSET ?`,
			)
				.bind(...params, pageSize, (page - 1) * pageSize)
				.all();

			return json(
				{
					users: (results || []).map((r0: unknown) => {
						const row = r0 as Record<string, unknown>;
						return {
							...row,
							email_verified: Number(row.email_verified),
							banned: Number(row.banned),
						};
					}),
					total: total?.n ?? 0,
					page,
					pageSize,
				},
				200,
				"private",
			);
		}

		// ── 邮件通道状态：配置摘要 + 最近 10 条发信记录（管理员，收件人脱敏） ──
		if (action === "mail-status") {
			const isAdmin = await verifyAdminRequest(request, cfEnv);
			if (!isAdmin) return unauthorized();

			const { results } = await cfEnv.DB.prepare(
				`SELECT created_at, status, subject, detail,
				        substr(to_email, 1, 1) || '***' AS to_masked
				 FROM mail_log ORDER BY created_at DESC LIMIT 10`,
			).all();
			// Brevo 的 2xx 只代表"已接收"，真正投递结果在它自己的事件流里；
			// 用 Worker 出站身份查询（本机 IP 通常不在账号白名单内，查不到）
			let brevoEvents: unknown = null;
			if (
				(cfEnv as { MAIL_PROVIDER?: string }).MAIL_PROVIDER === "brevo" &&
				(cfEnv as { BREVO_API_KEY?: string }).BREVO_API_KEY
			) {
				try {
					const r = await fetch(
						"https://api.brevo.com/v3/smtp/statistics/events?limit=8&sort=desc",
						{
							headers: {
								"api-key": String(
									(cfEnv as { BREVO_API_KEY?: string }).BREVO_API_KEY,
								),
								accept: "application/json",
							},
							signal: AbortSignal.timeout(8000),
						},
					);
					brevoEvents = r.ok
						? ((await r.json()) as { events?: unknown }).events
						: {
								error: `HTTP ${r.status}`,
								body: (await r.text()).slice(0, 200),
							};
				} catch (e) {
					brevoEvents = { error: (e as Error).message };
				}
			}
			return json(
				{
					config: describeMailConfig(cfEnv as RegisterEnv),
					recent: results || [],
					brevoEvents,
				},
				200,
				"private",
			);
		}

		// 登录态：未登录也返回 200 + authenticated:false（前端自查用）
		if (action === "me") {
			const me = await getAuthUser(request, cfEnv);
			if (!me)
				return json({ authenticated: false, user: null }, 200, "private");
			// 别名邮箱一并返回（多邮箱身份，0007 user_emails）
			const aliasRows = await cfEnv.DB.prepare(
				"SELECT email FROM user_emails WHERE user_id = ? ORDER BY created_at",
			)
				.bind(me.id)
				.all<{ email: string }>();
			return json(
				{
					authenticated: true,
					user: publicUser(
						me,
						(aliasRows.results || []).map((r: { email: string }) => r.email),
					),
					isAdmin: me.role === "admin",
					canAccess:
						me.role === "admin" ||
						(await listUserPerms(cfEnv.DB, me.id)).length > 0,
					perms:
						me.role === "admin"
							? [...PERM_IDS]
							: await listUserPerms(cfEnv.DB, me.id),
				},
				200,
				"private",
			);
		}
		// ── OAuth：start（302 授权页）/ callback（换 token → 三分支 → 登录）（D.2） ──
		if (segments[0] === "oauth") {
			const provider = segments[1] || "";
			const sub = segments[2] || "";
			if (!isOAuthProvider(provider))
				return json({ message: "不支持的登录方式" }, 404);
			// 限流复用 withRateLimit 新 scope 'oauth'（10 分钟 30 次/IP，覆盖 start+callback）
			return await withRateLimit(
				cfEnv,
				request,
				{
					windowMs: 10 * 60_000,
					maxRequests: 30,
					scope: "oauth",
				},
				async () => {
					if (sub === "start")
						return handleOauthStart(cfEnv, request, provider);
					if (sub === "callback")
						return handleOauthCallback(cfEnv, request, provider);
					return json({ message: "Not found" }, 404);
				},
			);
		}

		return json({ message: "Not found" }, 404);
	} catch (error) {
		if (action === "me")
			return json({ authenticated: false, user: null }, 200, "private");
		return serverError(error);
	}
};

export const ALL: APIRoute = async () => methodNotAllowed(["GET", "POST"]);

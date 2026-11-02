// 注册 / 邮箱验证 / Turnstile（设计 DESIGN-USER-SYSTEM.md D.1、D.4）
// 防枚举：注册与重发接口对「邮箱是否存在」返回完全一致的文案，差异只留在服务端日志

import type { CloudflareEnv } from "../../types/env";
import {
	type MailEnv,
	renderResetEmail,
	renderVerifyEmail,
	sendMail,
} from "../mail";
import { loadAdminEnv } from "./loadAdminEnv";
import {
	hashPassword,
	isBcryptHash,
	verifyPasswordAllowPlaintext,
} from "./password";

export const SIGNUP_VERIFY_HOURS = 24;
export const PASSWORD_MIN_LENGTH = 8;
export const NAME_MAX_LENGTH = 30;
export const EMAIL_MAX_LENGTH = 254;

export interface RegisterEnv extends MailEnv {
	TURNSTILE_SECRET_KEY?: string;
}

// ---------- 基础校验 ----------

export function normalizeEmail(raw: string): string {
	return raw.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
	if (!email || email.length > EMAIL_MAX_LENGTH) return false;
	// 轻量格式校验（不做域名 MX，避免 Workers 额外网络依赖）
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * 邮箱 → user_id 解析（含别名）：先查 users.email（主邮箱），再查 user_emails.email（别名）。
 * 登录、注册查重、OAuth 绑定等「按邮箱找用户」统一走这里，保证别名与主邮箱指向同一用户。
 */
export async function resolveUserEmail(
	db: D1Database,
	rawEmail: string,
): Promise<string | null> {
	const email = normalizeEmail(rawEmail);
	if (!email) return null;

	const main = await db
		.prepare("SELECT id FROM users WHERE email = ?")
		.bind(email)
		.first<{ id: string }>();
	if (main) return main.id;

	const alias = await db
		.prepare("SELECT user_id FROM user_emails WHERE email = ?")
		.bind(email)
		.first<{ user_id: string }>();
	return alias?.user_id ?? null;
}

/** 返回 null 表示通过，否则为用户可读错误文案 */
export function validatePassword(pw: string): string | null {
	if (!pw) return "密码不能为空";
	if (pw.length < PASSWORD_MIN_LENGTH)
		return `密码至少 ${PASSWORD_MIN_LENGTH} 位`;
	if (pw.length > 128) return "密码过长（最多 128 位）";
	return null;
}

export function validateName(name: string): string | null {
	const v = name.trim();
	if (!v) return "昵称不能为空";
	if (v.length > NAME_MAX_LENGTH) return `昵称最多 ${NAME_MAX_LENGTH} 个字符`;
	return null;
}

/** 本地 dev：cf-dev-shim 的 env 不带自定义变量，空值时兜底读 process.env（.dev.vars 已由 shim 灌入） */
function resolveVar(
	value: string | undefined,
	key: string,
): string | undefined {
	if (value?.trim()) return value.trim();
	if (typeof process !== "undefined" && process.env) {
		loadAdminEnv();
		return process.env[key]?.trim() || undefined;
	}
	return undefined;
}

// ---------- token 工具 ----------

function randomToken(bytes = 32): string {
	const arr = crypto.getRandomValues(new Uint8Array(bytes));
	return [...arr].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(input: string): Promise<string> {
	const buf = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(input),
	);
	return [...new Uint8Array(buf)]
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

// ---------- Turnstile（D.4：仅 register/login 校验） ----------

export interface TurnstileResult {
	ok: boolean;
	message?: string;
}

/**
 * 服务端 siteverify。
 * - 未配置 TURNSTILE_SECRET_KEY：跳过（与后台开关一致，不阻塞首次部署与登录），仅告警；
 * - 已配置：token 缺失或校验失败一律拒绝；网络故障同样拒绝（绝不放行）。
 */
export async function verifyTurnstile(
	env: RegisterEnv,
	token: string,
	remoteip: string,
	_requestHost?: string,
): Promise<TurnstileResult> {
	const secret = resolveVar(env.TURNSTILE_SECRET_KEY, "TURNSTILE_SECRET_KEY");
	if (!secret) {
		console.warn(
			"[turnstile] TURNSTILE_SECRET_KEY 未配置，跳过人机校验（如需启用请配置密钥）",
		);
		return { ok: true };
	}
	if (!token) return { ok: false, message: "请完成人机验证" };

	const remoteIp = remoteip?.trim();
	try {
		const body = new URLSearchParams({
			secret,
			response: token,
		});
		if (remoteIp) body.set("remoteip", remoteIp);

		const r = await fetch(
			"https://challenges.cloudflare.com/turnstile/v0/siteverify",
			{ method: "POST", body },
		);
		const data = (await r.json().catch(() => null)) as {
			success?: boolean;
			"error-codes"?: string[];
		} | null;
		if (data?.success) return { ok: true };
		console.warn("[turnstile] 校验失败:", data?.["error-codes"] || r.status);
		return { ok: false, message: "人机验证未通过，请重试" };
	} catch (e) {
		// 网络故障：拒绝而非放行，避免人机校验被静默绕过
		console.error("[turnstile] siteverify 请求异常:", e);
		return { ok: false, message: "人机验证服务不可用，请稍后再试" };
	}
}

// ---------- 注册 ----------

export interface RegisterInput {
	email: string;
	name: string;
	password: string;
}

export type RegisterOutcome =
	| { kind: "created"; verifyUrl?: string }
	| { kind: "duplicate" } // 邮箱已存在（对客户端不外泄，响应与 created 一致）
	| { kind: "invalid"; message: string };

interface UserRow {
	id: string;
	email_verified: number;
}

/** 建号（未验证）+ 生成验证 token + 发信；发信失败不改变结果（落库即注册成功） */
export async function registerUser(
	db: D1Database,
	env: RegisterEnv,
	input: RegisterInput,
	siteOrigin: string,
	siteName: string,
): Promise<RegisterOutcome> {
	const email = normalizeEmail(input.email);
	const name = input.name.trim();

	if (!isValidEmail(email))
		return { kind: "invalid", message: "邮箱格式不正确" };
	const nameErr = validateName(name);
	if (nameErr) return { kind: "invalid", message: nameErr };
	const pwErr = validatePassword(input.password);
	if (pwErr) return { kind: "invalid", message: pwErr };

	// 查重含别名：别名邮箱已指向某用户时同样视作已注册（防枚举语义不变）
	const resolvedId = await resolveUserEmail(db, email);
	const existing = resolvedId
		? await db
				.prepare("SELECT id, email_verified FROM users WHERE id = ?")
				.bind(resolvedId)
				.first<UserRow>()
		: null;

	if (existing) {
		// 防枚举：对调用方返回 duplicate，由 API 层渲染与 created 完全相同的响应；
		// 额度控制——仅「已注册但未验证」的账号重发验证信（限流在 API 层兜底）
		if (existing.email_verified !== 1) {
			await issueSignupVerification(
				db,
				env,
				existing.id,
				email,
				siteOrigin,
				siteName,
			);
		}
		return { kind: "duplicate" };
	}

	let passwordHash: string;
	try {
		passwordHash = await hashPassword(input.password);
	} catch (e) {
		console.error("[register] bcrypt 失败:", e);
		return { kind: "invalid", message: "密码处理失败，请稍后再试" };
	}

	let userId: string;
	try {
		userId = crypto.randomUUID();
		await db
			.prepare(
				`INSERT INTO users (id, email, email_verified, name, password, role, banned)
         VALUES (?, ?, 0, ?, ?, 'user', 0)`,
			)
			.bind(userId, email, name, passwordHash)
			.run();
	} catch (e) {
		// 唯一索引并发冲突：视作已存在
		console.warn("[register] INSERT users 冲突:", e);
		return { kind: "duplicate" };
	}

	const verifyUrl = await issueSignupVerification(
		db,
		env,
		userId,
		email,
		siteOrigin,
		siteName,
	);
	return { kind: "created", verifyUrl };
}

/** 生成一次性 signup token：库存 sha256，明文只进邮件链接；24h 有效 */
async function issueSignupVerification(
	db: D1Database,
	env: RegisterEnv,
	userId: string,
	email: string,
	siteOrigin: string,
	siteName: string,
): Promise<string | undefined> {
	try {
		const token = randomToken(32);
		const tokenHash = await sha256Hex(token);

		// 同用户同 purpose 只保留最新一条未使用的
		await db
			.prepare(
				"DELETE FROM email_verifications WHERE user_id = ? AND purpose = 'signup' AND used_at IS NULL",
			)
			.bind(userId)
			.run();
		await db
			.prepare(
				`INSERT INTO email_verifications (id, user_id, token_hash, purpose, expires_at)
         VALUES (?, ?, ?, 'signup', datetime('now', '+${SIGNUP_VERIFY_HOURS} hours'))`,
			)
			.bind(crypto.randomUUID(), userId, tokenHash)
			.run();

		// 站点 trailingSlash:"always"，路径必须带尾斜杠否则 404
		const verifyUrl = `${siteOrigin}/verify/?token=${encodeURIComponent(token)}`;
		// 失败不抛出：注册以落库为准，可走重发按钮（设计 G.6）
		const mail = renderVerifyEmail({
			siteName,
			url: verifyUrl,
			expireHours: SIGNUP_VERIFY_HOURS,
		});
		await sendMail(env, { to: email, ...mail });
		return verifyUrl;
	} catch (e) {
		console.error("[register] 发送验证邮件失败:", e);
		return undefined;
	}
}

// ---------- 验证 ----------

export type VerifyOutcome =
	| { ok: true; userId: string }
	| { ok: false; reason: "invalid" | "expired" };

/** hash 比对 → 置 email_verified=1 → 标记 token 已用 */
export async function verifySignupToken(
	db: D1Database,
	token: string,
): Promise<VerifyOutcome> {
	if (!token || token.length > 128) return { ok: false, reason: "invalid" };
	const tokenHash = await sha256Hex(token);

	const row = await db
		.prepare(
			`SELECT id, user_id FROM email_verifications
       WHERE token_hash = ? AND purpose = 'signup' AND used_at IS NULL
       ORDER BY created_at DESC LIMIT 1`,
		)
		.bind(tokenHash)
		.first<{ id: string; user_id: string }>();

	if (!row) {
		// 从未存在与已用过（重放）对用户是同一条「无效」文案；过期待遇由下方 expires_at 判定
		return { ok: false, reason: "invalid" };
	}

	const fresh = await db
		.prepare(
			"SELECT id FROM email_verifications WHERE id = ? AND expires_at > datetime('now')",
		)
		.bind(row.id)
		.first<{ id: string }>();
	if (!fresh) return { ok: false, reason: "expired" };

	try {
		// 不用 db.batch：cf-dev-shim 的本地 D1 仅实现 prepare（兼容 dev/生产两条路径）
		await db
			.prepare(
				"UPDATE users SET email_verified = 1, updated_at = datetime('now') WHERE id = ?",
			)
			.bind(row.user_id)
			.run();
		await db
			.prepare(
				"UPDATE email_verifications SET used_at = datetime('now') WHERE id = ?",
			)
			.bind(row.id)
			.run();
	} catch (e) {
		console.error("[verify] 激活失败:", e);
		return { ok: false, reason: "invalid" };
	}

	return { ok: true, userId: row.user_id };
}

/**
 * 重发验证邮件（防枚举：邮箱不存在/已验证也返回成功，且不发信）。
 * 库内只存 hash、明文不可恢复，故直接签发新 token 并作废旧的未使用记录
 * （内部 issueSignupVerification 先 DELETE 未使用的再 INSERT）。
 */
export async function resendVerification(
	db: D1Database,
	env: RegisterEnv,
	rawEmail: string,
	siteOrigin: string,
	siteName: string,
): Promise<void> {
	const email = normalizeEmail(rawEmail);
	if (!isValidEmail(email)) return;

	try {
		// 别名邮箱同样可触发重发（验证信发往调用方输入的邮箱本身）
		const resolvedId = await resolveUserEmail(db, email);
		const user = resolvedId
			? await db
					.prepare("SELECT id, email_verified FROM users WHERE id = ?")
					.bind(resolvedId)
					.first<UserRow>()
			: null;
		if (!user || user.email_verified === 1) return;

		await issueSignupVerification(
			db,
			env,
			user.id,
			email,
			siteOrigin,
			siteName,
		);
	} catch (e) {
		console.error("[resend] 重发验证邮件失败:", e);
	}
}

// ---------- 首次初始化站长 ----------

export type BootstrapOutcome =
	| { ok: true; userId: string }
	| {
			ok: false;
			reason: "exists" | "invalid" | "legacy_required" | "legacy_invalid";
			message?: string;
	  };

/**
 * 首次部署初始化：users 为空时创建 role='admin' 的站长。
 * 旧站若仍有 admin_users 行，必须提供原管理员密码完成认领，密码哈希沿用。
 */
export async function bootstrapOwner(
	db: D1Database,
	_env: RegisterEnv,
	input: {
		email: string;
		name: string;
		password: string;
		legacyPassword?: string;
	},
	_siteOrigin: string,
	_siteName: string,
): Promise<BootstrapOutcome> {
	const any = await db.prepare("SELECT id FROM users LIMIT 1").first<{
		id: string;
	}>();
	if (any) return { ok: false, reason: "exists", message: "站点已初始化" };

	const email = normalizeEmail(input.email);
	const name = input.name.trim();
	if (!isValidEmail(email))
		return { ok: false, reason: "invalid", message: "邮箱格式不正确" };
	const nameErr = validateName(name);
	if (nameErr) return { ok: false, reason: "invalid", message: nameErr };
	const pwErr = validatePassword(input.password);
	if (pwErr) return { ok: false, reason: "invalid", message: pwErr };

	let legacy: { password_hash: string } | null = null;
	try {
		legacy = await db
			.prepare("SELECT password_hash FROM admin_users LIMIT 1")
			.first<{ password_hash: string }>();
	} catch {
		legacy = null;
	}

	let passwordHash: string;
	if (legacy) {
		if (!input.legacyPassword)
			return {
				ok: false,
				reason: "legacy_required",
				message: "请输入原管理员密码完成认领",
			};
		const valid = await verifyPasswordAllowPlaintext(
			input.legacyPassword,
			legacy.password_hash,
		);
		if (!valid)
			return {
				ok: false,
				reason: "legacy_invalid",
				message: "原管理员密码不正确",
			};
		// 认领成功后使用初始化表单里设置的新密码；旧密码只用于证明身份
		passwordHash = await hashPassword(input.password);
	} else {
		passwordHash = await hashPassword(input.password);
	}

	const id = crypto.randomUUID();
	try {
		await db
			.prepare(
				`INSERT INTO users (id, email, email_verified, name, password, role)
         VALUES (?, ?, 1, ?, ?, 'admin')`,
			)
			.bind(id, email, name, passwordHash)
			.run();
	} catch (e) {
		console.error("[bootstrap] 创建站长失败:", e);
		return { ok: false, reason: "invalid", message: "创建失败，请稍后重试" };
	}
	return { ok: true, userId: id };
}

// ---------- 密码重置 ----------

export const RESET_VERIFY_HOURS = 1;

/** 防枚举：邮箱不存在/未验证也静默成功 */
export async function requestPasswordReset(
	db: D1Database,
	env: RegisterEnv,
	rawEmail: string,
	siteOrigin: string,
	siteName: string,
): Promise<void> {
	const email = normalizeEmail(rawEmail);
	if (!isValidEmail(email)) return;

	try {
		const resolvedId = await resolveUserEmail(db, email);
		const user = resolvedId
			? await db
					.prepare("SELECT id, email_verified FROM users WHERE id = ?")
					.bind(resolvedId)
					.first<UserRow>()
			: null;
		if (!user || user.email_verified !== 1) return;

		const token = randomToken(32);
		const tokenHash = await sha256Hex(token);
		const expires = new Date(Date.now() + RESET_VERIFY_HOURS * 3600_000)
			.toISOString()
			.replace("T", " ")
			.slice(0, 19);

		await db
			.prepare(
				"DELETE FROM email_verifications WHERE user_id = ? AND purpose = 'reset' AND used_at IS NULL",
			)
			.bind(user.id)
			.run();
		await db
			.prepare(
				`INSERT INTO email_verifications (id, user_id, token_hash, purpose, expires_at)
         VALUES (?, ?, ?, 'reset', ?)`,
			)
			.bind(crypto.randomUUID(), user.id, tokenHash, expires)
			.run();

		const origin = siteOrigin.replace(/\/$/, "");
		const url = `${origin}/login/?mode=reset&token=${encodeURIComponent(token)}`;
		const mail = renderResetEmail({ siteName, url });
		await sendMail(env, { to: email, ...mail });
	} catch (e) {
		console.error("[reset] 发送重置邮件失败:", e);
	}
}

export type ResetOutcome =
	| { ok: true; userId: string }
	| { ok: false; reason: "invalid" | "expired" };

export async function resetPassword(
	db: D1Database,
	token: string,
	newPassword: string,
): Promise<ResetOutcome> {
	if (!token || token.length > 128) return { ok: false, reason: "invalid" };
	const pwErr = validatePassword(newPassword);
	if (pwErr) return { ok: false, reason: "invalid" };

	const tokenHash = await sha256Hex(token);
	const row = await db
		.prepare(
			`SELECT id, user_id FROM email_verifications
       WHERE token_hash = ? AND purpose = 'reset' AND used_at IS NULL
       ORDER BY created_at DESC LIMIT 1`,
		)
		.bind(tokenHash)
		.first<{ id: string; user_id: string }>();
	if (!row) return { ok: false, reason: "invalid" };

	const fresh = await db
		.prepare(
			"SELECT id FROM email_verifications WHERE id = ? AND expires_at > datetime('now')",
		)
		.bind(row.id)
		.first<{ id: string }>();
	if (!fresh) return { ok: false, reason: "expired" };

	try {
		const hash = await hashPassword(newPassword);
		await db
			.prepare(
				"UPDATE users SET password = ?, updated_at = datetime('now') WHERE id = ?",
			)
			.bind(hash, row.user_id)
			.run();
		await db
			.prepare(
				"UPDATE email_verifications SET used_at = datetime('now') WHERE id = ?",
			)
			.bind(row.id)
			.run();
	} catch (e) {
		console.error("[reset] 重置失败:", e);
		return { ok: false, reason: "invalid" };
	}
	return { ok: true, userId: row.user_id };
}

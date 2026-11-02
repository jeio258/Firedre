// OAuth 一键登录：GitHub / Google 授权码流程（设计 DESIGN-USER-SYSTEM.md D.2）
//
// state 存储方案：HMAC 签名 Cookie（oauth_state），理由见文件尾 buildStateCookie 注释。
// 三分支（D.2）：
//   1. oauth_accounts(provider, provider_user_id) 命中 → 直接登录
//   2. 未命中但 users.email 已存在 → 绑定到既有账号后登录（回跳带 notice=oauth_bound）
//   3. 都不存在 → 建号（email_verified=1，provider 已验证；带 name/avatar）+ 绑定 + 登录

import type { CloudflareEnv } from "../../types/env";
import { constantTimeEqual } from "../utils/timingSafe";
import { loadAdminEnv } from "./loadAdminEnv";
import { normalizeEmail, resolveUserEmail } from "./register";
import {
	buildUserSessionCookie,
	createSessionToken,
	getUserSecret,
	type UserSessionEnv,
} from "./userSession";

// ---------- provider 配置 ----------

export type OAuthProviderId = "github" | "google";

export const OAUTH_PROVIDERS: readonly OAuthProviderId[] = ["github", "google"];

export function isOAuthProvider(v: string): v is OAuthProviderId {
	return (OAUTH_PROVIDERS as readonly string[]).includes(v);
}

export interface OAuthProfile {
	/** provider 侧用户唯一 id（github: 数字 id；google: sub） */
	providerUserId: string;
	/** 已验证邮箱（小写）；拿不到已验证邮箱时由调用方拒绝 */
	email: string;
	name: string;
	avatar: string;
}

export interface OAuthClientConfig {
	clientId: string;
	clientSecret: string;
}

/** 本地 dev：cf-dev-shim 的 env 不带自定义变量，空值时兜底读 process.env（.dev.vars 已由 loadAdminEnv 灌入） */
function resolveVar(env: UserSessionEnv, key: string): string | undefined {
	const e = env as unknown as Record<string, unknown>;
	const direct = e?.[key];
	if (typeof direct === "string" && direct.trim()) return direct.trim();
	if (typeof process !== "undefined" && process.env) {
		// loadAdminEnv 有 root 级缓存，重复调用零成本
		loadAdminEnv();
		return process.env[key]?.trim() || undefined;
	}
	return undefined;
}

/** 读取 provider 凭据；返回 null = 未配置（client_id/secret 必须同时存在） */
export function getOAuthClientConfig(
	env: UserSessionEnv,
	provider: OAuthProviderId,
): OAuthClientConfig | null {
	const idKey = provider === "github" ? "GITHUB_CLIENT_ID" : "GOOGLE_CLIENT_ID";
	const secretKey =
		provider === "github" ? "GITHUB_CLIENT_SECRET" : "GOOGLE_CLIENT_SECRET";
	const clientId = resolveVar(env, idKey);
	const clientSecret = resolveVar(env, secretKey);
	if (!clientId || !clientSecret) return null;
	return { clientId, clientSecret };
}

// ---------- state（签名 Cookie） ----------

const STATE_COOKIE = "oauth_state";
const STATE_TTL_MS = 10 * 60 * 1000; // 10 分钟（D.2）
const STATE_SIG_CONTEXT = "oauth-state:v1";

interface StatePayload {
	s: string; // 随机 state（与回调 query.state 比对）
	p: OAuthProviderId;
	n: string; // 登录成功后的回跳路径（站内白名单）
	exp: number;
}

// btoa/atob 只处理 latin1：payload 里的回跳路径可能是中文，先转 UTF-8 字节再编码
function b64urlEncode(input: string): string {
	const bytes = new TextEncoder().encode(input);
	if (typeof btoa === "function") {
		let binary = "";
		for (const byte of bytes) binary += String.fromCharCode(byte);
		return btoa(binary)
			.replace(/\+/g, "-")
			.replace(/\//g, "_")
			.replace(/=+$/, "");
	}
	return Buffer.from(bytes).toString("base64url");
}

function b64urlDecode(input: string): string {
	const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
	const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
	if (typeof atob === "function") {
		const binary = atob(padded);
		const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
		return new TextDecoder().decode(bytes);
	}
	return Buffer.from(padded, "base64").toString("utf8");
}

async function hmacSign(payload: string, secret: string): Promise<string> {
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const sig = await crypto.subtle.sign(
		"HMAC",
		key,
		new TextEncoder().encode(payload),
	);
	const bytes = new Uint8Array(sig);
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	if (typeof btoa === "function") {
		return btoa(binary)
			.replace(/\+/g, "-")
			.replace(/\//g, "_")
			.replace(/=+$/, "");
	}
	return Buffer.from(bytes).toString("base64url");
}

/** 密钥派生：与 user_session 同源但加域前缀，避免跨用途复用同一 HMAC 输入 */
async function getStateSecret(env: UserSessionEnv): Promise<string | null> {
	try {
		return `${STATE_SIG_CONTEXT}:${getUserSecret(env)}`;
	} catch {
		return null;
	}
}

function randomHex(bytes: number): string {
	const arr = crypto.getRandomValues(new Uint8Array(bytes));
	return [...arr].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** 站内回跳白名单（防 open redirect）：必须以单个 / 开头，且不是 // 或 /\ 开头 */
export function safeNextPath(raw: string | null | undefined): string {
	if (!raw) return "";
	const v = raw.trim();
	if (!v.startsWith("/") || v.startsWith("//") || v.startsWith("/\\"))
		return "";
	return v;
}

/**
 * 构造 oauth_state Set-Cookie。
 * 选择签名 Cookie 而非 KV/D1 的理由：
 * - wrangler.toml 只有 D1 + R2 绑定，没有 KV/DO；D1 建 state 表需要动 migrations/**（本任务禁改）
 * - 与 userSession 的「无状态 HMAC Cookie」架构一致，同一密钥体系、零新增基础设施
 * - OAuth 回调是 provider 302 过来的 top-level GET 导航，SameSite=Lax Cookie 必会随行
 * - exp 内嵌 payload，10 分钟过期语义完整；HttpOnly 防脚本读取
 * 代价：同一浏览器并行发起两次 OAuth 会互相覆盖 state（小站可接受，回调比对失败即拒绝）。
 */
async function buildStateCookie(
	env: UserSessionEnv,
	payload: StatePayload,
	secure: boolean,
): Promise<string | null> {
	const secret = await getStateSecret(env);
	if (!secret) return null;
	const body = b64urlEncode(JSON.stringify(payload));
	const sig = await hmacSign(body, secret);
	const parts = [
		`${STATE_COOKIE}=${encodeURIComponent(`${body}.${sig}`)}`,
		"Path=/",
		"HttpOnly",
		"SameSite=Lax",
		`Max-Age=${Math.floor(STATE_TTL_MS / 1000)}`,
	];
	if (secure) parts.push("Secure");
	return parts.join("; ");
}

function buildClearStateCookie(secure: boolean): string {
	const parts = [
		`${STATE_COOKIE}=`,
		"Path=/",
		"HttpOnly",
		"SameSite=Lax",
		"Max-Age=0",
	];
	if (secure) parts.push("Secure");
	return parts.join("; ");
}

/** 校验回调携带的 state：Cookie 验签 + 过期 + provider 匹配 + 与 query.state 恒时比对 */
async function verifyState(
	env: UserSessionEnv,
	request: Request,
	provider: OAuthProviderId,
	queryState: string,
): Promise<StatePayload | null> {
	const cookieHeader = request.headers.get("Cookie");
	if (!cookieHeader) return null;
	let raw: string | null = null;
	for (const part of cookieHeader.split(";")) {
		const [k, ...rest] = part.trim().split("=");
		if (k === STATE_COOKIE) {
			try {
				raw = decodeURIComponent(rest.join("="));
			} catch {
				// 被篡改成非法编码序列的 Cookie 按无 state 处理（回调走 state 失败页，而不是 500）
				return null;
			}
			break;
		}
	}
	if (!raw) return null;

	const [body, sig] = raw.split(".");
	if (!body || !sig) return null;

	const secret = await getStateSecret(env);
	if (!secret) return null;
	const expected = await hmacSign(body, secret);
	if (!constantTimeEqual(expected, sig)) return null;

	let payload: StatePayload;
	try {
		payload = JSON.parse(b64urlDecode(body)) as StatePayload;
	} catch {
		return null;
	}
	if (!payload?.s || payload.p !== provider) return null;
	if (!payload.exp || Date.now() > payload.exp) return null;
	if (!queryState || !constantTimeEqual(payload.s, queryState)) return null;
	return payload;
}

// ---------- 授权页 / token 交换 / profile ----------

function redirectUriOf(origin: string, provider: OAuthProviderId): string {
	// 站点 trailingSlash:"always"，回调路径带尾斜杠（Google 对 redirect_uri 精确匹配，
	// start 与 callback 用同一函数构造，保证两处一致）
	return `${origin}/api/auth/oauth/${provider}/callback/`;
}

function authorizeUrlOf(
	provider: OAuthProviderId,
	config: OAuthClientConfig,
	redirectUri: string,
	state: string,
): string {
	if (provider === "github") {
		const u = new URL("https://github.com/login/oauth/authorize");
		u.searchParams.set("client_id", config.clientId);
		u.searchParams.set("redirect_uri", redirectUri);
		u.searchParams.set("scope", "read:user user:email");
		u.searchParams.set("state", state);
		return u.toString();
	}
	const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
	u.searchParams.set("client_id", config.clientId);
	u.searchParams.set("redirect_uri", redirectUri);
	u.searchParams.set("response_type", "code");
	u.searchParams.set("scope", "openid email profile");
	u.searchParams.set("state", state);
	u.searchParams.set("prompt", "select_account");
	return u.toString();
}

class OAuthUpstreamError extends Error {
	constructor(
		readonly code: OAuthErrorCode,
		message: string,
	) {
		super(message);
	}
}

async function exchangeToken(
	provider: OAuthProviderId,
	config: OAuthClientConfig,
	code: string,
	redirectUri: string,
): Promise<string> {
	const body = new URLSearchParams({
		client_id: config.clientId,
		client_secret: config.clientSecret,
		code,
		redirect_uri: redirectUri,
	});
	if (provider === "google") body.set("grant_type", "authorization_code");

	const url =
		provider === "github"
			? "https://github.com/login/oauth/access_token"
			: "https://oauth2.googleapis.com/token";

	const r = await fetch(url, {
		method: "POST",
		headers: {
			Accept: "application/json",
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body,
		signal: AbortSignal.timeout(10_000),
	});
	const data = (await r.json().catch(() => null)) as {
		access_token?: string;
		error?: string;
		error_description?: string;
	} | null;

	if (!r.ok || !data?.access_token) {
		throw new OAuthUpstreamError(
			"exchange",
			`token 交换失败: ${r.status} ${data?.error || ""} ${data?.error_description || ""}`.trim(),
		);
	}
	return data.access_token;
}

async function fetchProfile(
	provider: OAuthProviderId,
	accessToken: string,
): Promise<OAuthProfile> {
	if (provider === "github") return fetchGithubProfile(accessToken);
	return fetchGoogleProfile(accessToken);
}

async function fetchGithubProfile(accessToken: string): Promise<OAuthProfile> {
	const headers = {
		Authorization: `Bearer ${accessToken}`,
		Accept: "application/vnd.github+json",
		"User-Agent": "Firedre-OAuth",
		"X-GitHub-Api-Version": "2022-11-28",
	};
	const userResp = await fetch("https://api.github.com/user", {
		headers,
		signal: AbortSignal.timeout(10_000),
	});
	if (!userResp.ok) {
		throw new OAuthUpstreamError(
			"exchange",
			`GitHub /user 失败: ${userResp.status}`,
		);
	}
	const user = (await userResp.json()) as {
		id?: number;
		login?: string;
		name?: string | null;
		avatar_url?: string;
		email?: string | null;
	};

	// email 可能为 null（个人资料设为私有）→ /user/emails 兜底，只认 verified
	let email = (user.email || "").trim().toLowerCase();
	if (!email) {
		const emailsResp = await fetch("https://api.github.com/user/emails", {
			headers,
			signal: AbortSignal.timeout(10_000),
		});
		if (emailsResp.ok) {
			const emails = (await emailsResp.json()) as Array<{
				email: string;
				primary?: boolean;
				verified?: boolean;
			}>;
			const verified = emails.filter((e) => e.verified && e.email);
			const chosen = verified.find((e) => e.primary) || verified[0] || null;
			email = (chosen?.email || "").trim().toLowerCase();
		}
	}
	if (!email) {
		throw new OAuthUpstreamError("no_email", "GitHub 账号没有可用的已验证邮箱");
	}

	const fallback = user.login || email.split("@")[0];
	return {
		providerUserId: String(user.id ?? ""),
		email,
		name: (user.name || fallback).trim() || fallback,
		avatar: (user.avatar_url || "").trim(),
	};
}

async function fetchGoogleProfile(accessToken: string): Promise<OAuthProfile> {
	const r = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
		headers: { Authorization: `Bearer ${accessToken}` },
		signal: AbortSignal.timeout(10_000),
	});
	if (!r.ok) {
		throw new OAuthUpstreamError(
			"exchange",
			`Google userinfo 失败: ${r.status}`,
		);
	}
	const info = (await r.json()) as {
		sub?: string;
		email?: string;
		email_verified?: boolean;
		name?: string;
		picture?: string;
	};
	const email = normalizeEmail(info.email || "");
	if (!email) throw new OAuthUpstreamError("no_email", "Google 未返回邮箱");
	if (info.email_verified !== true)
		throw new OAuthUpstreamError("email_unverified", "Google 邮箱未验证");

	return {
		providerUserId: String(info.sub ?? ""),
		email,
		name: (info.name || email.split("@")[0]).trim(),
		avatar: (info.picture || "").trim(),
	};
}

// ---------- 建号 / 绑定 / 登录（D.2 三分支） ----------

interface SettledUser {
	userId: string;
	role: string;
	/** true = 绑定到了已存在的本地账号（回跳时提示） */
	boundExisting: boolean;
}

const NAME_MAX_LENGTH = 30;

async function settleUser(
	db: D1Database,
	provider: OAuthProviderId,
	profile: OAuthProfile,
): Promise<SettledUser> {
	if (!profile.providerUserId) {
		throw new OAuthUpstreamError("server", "provider 未返回用户 id");
	}

	// 分支 1：oauth_accounts 命中 → 直接登录
	const bound = await db
		.prepare(
			`SELECT u.id AS user_id, u.role, u.banned
       FROM oauth_accounts oa JOIN users u ON u.id = oa.user_id
      WHERE oa.provider = ? AND oa.provider_user_id = ?`,
		)
		.bind(provider, profile.providerUserId)
		.first<{ user_id: string; role: string; banned: number }>();
	if (bound) {
		if (bound.banned === 1)
			throw new OAuthUpstreamError("banned", "该账号已被封禁");
		return { userId: bound.user_id, role: bound.role, boundExisting: false };
	}

	// 分支 2：邮箱已有本地账号（主邮箱或别名，经 resolveUserEmail 解析）→ 绑定后登录
	const existingId = await resolveUserEmail(db, profile.email);
	const existing = existingId
		? await db
				.prepare("SELECT id, role, banned FROM users WHERE id = ?")
				.bind(existingId)
				.first<{ id: string; role: string; banned: number }>()
		: null;
	if (existing) {
		if (existing.banned === 1)
			throw new OAuthUpstreamError("banned", "该账号已被封禁");
		await bindAccount(db, existing.id, provider, profile.providerUserId);
		return { userId: existing.id, role: existing.role, boundExisting: true };
	}

	// 分支 3：建号（provider 已验证 → email_verified=1）+ 绑定 + 登录
	const userId = crypto.randomUUID();
	const name =
		profile.name.slice(0, NAME_MAX_LENGTH) || profile.email.split("@")[0];
	try {
		await db
			.prepare(
				`INSERT INTO users (id, email, email_verified, name, password, avatar, role, banned)
         VALUES (?, ?, 1, ?, '', ?, 'user', 0)`,
			)
			.bind(userId, profile.email, name, profile.avatar.slice(0, 500))
			.run();
	} catch (e) {
		// 唯一索引并发冲突（同邮箱同时注册/回调）：回退到绑定既有账号
		console.warn("[oauth] INSERT users 冲突，回退绑定分支:", e);
		const rowId = await resolveUserEmail(db, profile.email);
		const row = rowId
			? await db
					.prepare("SELECT id, role, banned FROM users WHERE id = ?")
					.bind(rowId)
					.first<{ id: string; role: string; banned: number }>()
			: null;
		if (!row) throw new OAuthUpstreamError("server", "创建账号失败");
		if (row.banned === 1)
			throw new OAuthUpstreamError("banned", "该账号已被封禁");
		await bindAccount(db, row.id, provider, profile.providerUserId);
		return { userId: row.id, role: row.role, boundExisting: true };
	}

	await bindAccount(db, userId, provider, profile.providerUserId);
	return { userId, role: "user", boundExisting: false };
}

async function bindAccount(
	db: D1Database,
	userId: string,
	provider: OAuthProviderId,
	providerUserId: string,
): Promise<void> {
	// 同 user 同 provider 只允许一行（表仅约束 provider+provider_user_id 唯一）
	const already = await db
		.prepare("SELECT id FROM oauth_accounts WHERE user_id = ? AND provider = ?")
		.bind(userId, provider)
		.first<{ id: string }>();
	if (already) return;

	try {
		await db
			.prepare(
				`INSERT INTO oauth_accounts (id, user_id, provider, provider_user_id)
         VALUES (?, ?, ?, ?)`,
			)
			.bind(crypto.randomUUID(), userId, provider, providerUserId)
			.run();
	} catch (e) {
		// (provider, provider_user_id) 并发唯一冲突：另一回调先插成功，忽略即可
		console.warn("[oauth] INSERT oauth_accounts 冲突（忽略）:", e);
	}
}

// ---------- start / callback ----------

export type OAuthErrorCode =
	| "state"
	| "not_configured"
	| "exchange"
	| "no_email"
	| "email_unverified"
	| "banned"
	| "server";

/** 登录页可读的错误码 → 文案（LoginCard.svelte 同步维护一份映射） */
export const OAUTH_ERROR_MESSAGES: Record<OAuthErrorCode, string> = {
	state: "登录状态已失效或校验未通过，请重新发起登录",
	not_configured: "该第三方登录尚未配置",
	exchange: "第三方登录验证失败，请稍后再试",
	no_email: "第三方账号没有可用的已验证邮箱，无法登录",
	email_unverified: "第三方账号邮箱未通过验证，无法登录",
	banned: "该账号已被封禁",
	server: "服务器错误，请稍后再试",
};

function isOAuthErrorCode(v: string): v is OAuthErrorCode {
	return Object.hasOwn(OAUTH_ERROR_MESSAGES, v);
}

function redirectWithCookies(location: string, cookies: string[]): Response {
	const res = new Response(null, { status: 302, headers: {} });
	res.headers.set("Location", location);
	res.headers.set("Cache-Control", "no-store");
	for (const c of cookies) res.headers.append("Set-Cookie", c);
	return res;
}

function oauthErrorRedirect(
	origin: string,
	code: OAuthErrorCode,
	secure: boolean,
): Response {
	const u = new URL(`${origin}/login/`);
	u.searchParams.set("oauth_error", code);
	return redirectWithCookies(u.toString(), [buildClearStateCookie(secure)]);
}

/** GET /api/auth/oauth/<provider>/start —— 生成 state（10 分钟签名 Cookie）→ 302 授权页 */
export async function handleOauthStart(
	env: CloudflareEnv,
	request: Request,
	provider: OAuthProviderId,
): Promise<Response> {
	const url = new URL(request.url);
	const origin = url.origin;
	const secure = url.protocol === "https:";

	const config = getOAuthClientConfig(env, provider);
	if (!config) {
		// 未配置属「受控错误」：回登录页提示，而非 500
		return oauthErrorRedirect(origin, "not_configured", secure);
	}

	const secret = await getStateSecret(env);
	if (!secret) return oauthErrorRedirect(origin, "server", secure);

	const state = randomHex(32);
	const cookie = await buildStateCookie(
		env,
		{
			s: state,
			p: provider,
			n: safeNextPath(url.searchParams.get("next")),
			exp: Date.now() + STATE_TTL_MS,
		},
		secure,
	);
	if (!cookie) return oauthErrorRedirect(origin, "server", secure);

	const redirectUri = redirectUriOf(origin, provider);
	return redirectWithCookies(
		authorizeUrlOf(provider, config, redirectUri, state),
		[cookie],
	);
}

/** GET /api/auth/oauth/<provider>/callback —— state 比对 → 换 token → 取 profile → 三分支 → 登录 */
export async function handleOauthCallback(
	env: CloudflareEnv,
	request: Request,
	provider: OAuthProviderId,
): Promise<Response> {
	const url = new URL(request.url);
	const origin = url.origin;
	const secure = url.protocol === "https:";

	// 1) state 比对（Cookie 验签 + 过期 + provider + query.state）
	const payload = await verifyState(
		env,
		request,
		provider,
		url.searchParams.get("state") || "",
	);
	if (!payload) return oauthErrorRedirect(origin, "state", secure);

	const code = url.searchParams.get("code") || "";
	if (!code) return oauthErrorRedirect(origin, "exchange", secure);

	const config = getOAuthClientConfig(env, provider);
	if (!config) return oauthErrorRedirect(origin, "not_configured", secure);

	try {
		// 2) 交换 token
		const redirectUri = redirectUriOf(origin, provider);
		const accessToken = await exchangeToken(
			provider,
			config,
			code,
			redirectUri,
		);

		// 3) 取 profile（含已验证邮箱）
		const profile = await fetchProfile(provider, accessToken);

		// 4) D.2 三分支：命中绑定 / 绑定既有账号 / 建号
		const settled = await settleUser(env.DB, provider, profile);

		// 5) 签发 user_session + 清 state cookie → 回前台
		const token = await createSessionToken(settled.userId, settled.role, env);
		const next = safeNextPath(payload.n) || "/profile/";
		const target = new URL(next, origin);
		if (settled.boundExisting) target.searchParams.set("notice", "oauth_bound");
		return redirectWithCookies(target.toString(), [
			buildUserSessionCookie(token, secure, true),
			buildClearStateCookie(secure),
		]);
	} catch (e) {
		const code: OAuthErrorCode =
			e instanceof OAuthUpstreamError && isOAuthErrorCode(e.code)
				? e.code
				: "server";
		if (!(e instanceof OAuthUpstreamError)) {
			console.error("[oauth] callback 异常:", e);
		} else {
			console.warn(`[oauth:${provider}] ${e.code}: ${e.message}`);
		}
		return oauthErrorRedirect(origin, code, secure);
	}
}

import type { CloudflareEnv } from "../../types/env";
import { sha256Hex } from "../utils/hash";
import { constantTimeEqual } from "../utils/timingSafe";
import { loadAdminEnv } from "./loadAdminEnv";
import { BCRYPT_ROUNDS, verifyPasswordAllowPlaintext } from "./password";

// 前台用户会话：无状态 HMAC Cookie，payload = {u,role,exp,v}。
// 无法主动吊销 → 封禁每次请求查 users.banned，改密靠密码指纹 v 比对即时失效。

export const USER_SESSION_COOKIE = "user_session";

export const USER_SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 天

export const ADMIN_SESSION_TTL = 60 * 60 * 4; // 管理员 4 小时

export interface UserAuthEnv {
	USER_SESSION_SECRET?: string;
	SESSION_SECRET?: string;
}

export type UserSessionEnv = CloudflareEnv | UserAuthEnv;

export interface UserSessionPayload {
	u: string;
	role: string;
	exp: number;
	v: string;
}

export interface AuthUser {
	id: string;
	email: string;
	email_verified: number;
	name: string;
	avatar: string;
	bio: string;
	role: string;
	banned: number;
	created_at: string;
}

export function sessionMaxAge(role: string): number {
	return role === "admin" ? ADMIN_SESSION_TTL : USER_SESSION_MAX_AGE;
}

// 本地 dev 的 env 只注入 DB/BUCKET/SESSION_SECRET，其余变量由 loadAdminEnv 灌进 process.env
function readInjectedSecret(env?: UserSessionEnv): string | undefined {
	const e = env as UserAuthEnv | undefined;
	const own = e?.USER_SESSION_SECRET?.trim();
	if (own) return own;

	let fromProcess = "";
	if (typeof process !== "undefined" && process.env) {
		loadAdminEnv();
		fromProcess = process.env.USER_SESSION_SECRET?.trim() || "";
	}
	if (fromProcess) return fromProcess;

	// 回退旧密钥：加域前缀隔离，避免与 admin_session 的签名输入重合
	const legacy =
		e?.SESSION_SECRET?.trim() ||
		(typeof process !== "undefined" && process.env
			? process.env.SESSION_SECRET?.trim()
			: "") ||
		"";
	return legacy ? `user-session:v1:${legacy}` : undefined;
}

export function getUserSecret(env?: UserSessionEnv): string {
	const secret = readInjectedSecret(env);
	if (!secret) {
		throw new Error(
			"USER_SESSION_SECRET 未配置。该密钥是前台用户会话签名密钥，用户无法登录。请在 Cloudflare Secrets 中设置 USER_SESSION_SECRET。",
		);
	}
	return secret;
}

function getUserSecretQuietly(env?: UserSessionEnv): string | null {
	try {
		return getUserSecret(env);
	} catch {
		return null;
	}
}

// btoa/atob 只处理 latin1：先经 TextEncoder 转 UTF-8 字节再喂 btoa
function base64urlEncode(input: string) {
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

function base64urlDecode(input: string) {
	const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
	const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);

	if (typeof atob === "function") {
		const binary = atob(padded);
		const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
		return new TextDecoder().decode(bytes);
	}

	return Buffer.from(padded, "base64").toString("utf8");
}

async function hmacSign(payload: string, secret: string) {
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const signature = await crypto.subtle.sign(
		"HMAC",
		key,
		new TextEncoder().encode(payload),
	);
	const bytes = new Uint8Array(signature);

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

async function fingerprintOf(
	db: D1Database | undefined,
	userId: string,
): Promise<string | null> {
	if (!db) return null;
	try {
		const row = await db
			.prepare("SELECT password FROM users WHERE id = ?")
			.bind(userId)
			.first<{ password: string }>();
		if (!row) return null;
		return (await sha256Hex(row.password ?? "")).slice(0, 16);
	} catch {
		return null;
	}
}

/**
 * 签发用户会话 token。密码指纹从 users.password 现取（env 需带 DB）：
 * 改密后旧 token 的 v 不再匹配 → 立即失效。
 * 默认时长按角色取（admin 4h / 用户 30 天），显式传 maxAgeSeconds 才覆盖。
 */
export async function createSessionToken(
	userId: string,
	role: string,
	env?: UserSessionEnv,
	maxAgeSeconds?: number,
): Promise<string> {
	const secret = getUserSecret(env);
	const db = (env as CloudflareEnv | undefined)?.DB;
	const v = (await fingerprintOf(db, userId)) ?? "";

	const exp = Date.now() + (maxAgeSeconds ?? sessionMaxAge(role)) * 1000;
	const payload = base64urlEncode(
		JSON.stringify({ u: userId, role, exp, v } satisfies UserSessionPayload),
	);
	const sig = await hmacSign(payload, secret);
	return `${payload}.${sig}`;
}

export async function getSessionPayload(
	token: string,
	env?: UserSessionEnv,
): Promise<UserSessionPayload | null> {
	const secret = getUserSecretQuietly(env);
	if (!secret || !token) return null;

	const [payload, sig] = token.split(".");
	if (!payload || !sig) return null;

	const expected = await hmacSign(payload, secret);
	if (!constantTimeEqual(expected, sig)) return null;

	try {
		const data = JSON.parse(base64urlDecode(payload)) as UserSessionPayload;
		if (!data.exp || Date.now() > data.exp) return null;
		if (!data.u) return null;
		return data;
	} catch {
		return null;
	}
}

export function getCookieValue(
	cookieHeader: string | null | undefined,
	name: string,
) {
	if (!cookieHeader) return null;

	for (const part of cookieHeader.split(";")) {
		const [rawKey, ...rest] = part.trim().split("=");
		if (rawKey !== name) continue;
		const raw = rest.join("=");
		try {
			return decodeURIComponent(raw);
		} catch {
			// 非法编码序列回退原值，避免坏 Cookie 触发 500
			return raw;
		}
	}

	return null;
}

export function hasUserSessionCookie(
	cookieHeader: string | null | undefined,
): boolean {
	if (!cookieHeader) return false;
	return /(?:^|;\s*)user_session=/.test(cookieHeader);
}

/** persistent=false 时不带 Max-Age，关浏览器即失效；maxAgeSeconds 与 token 有效期保持一致 */
export function buildUserSessionCookie(
	token: string,
	secure: boolean,
	persistent = true,
	maxAgeSeconds = USER_SESSION_MAX_AGE,
) {
	const parts = [
		`${USER_SESSION_COOKIE}=${encodeURIComponent(token)}`,
		"Path=/",
		"HttpOnly",
		"SameSite=Lax",
	];
	if (persistent) parts.push(`Max-Age=${maxAgeSeconds}`);
	if (secure) parts.push("Secure");
	return parts.join("; ");
}

export function buildClearUserSessionCookie(secure: boolean) {
	const parts = [
		`${USER_SESSION_COOKIE}=`,
		"Path=/",
		"HttpOnly",
		"SameSite=Lax",
		"Max-Age=0",
	];
	if (secure) parts.push("Secure");
	return parts.join("; ");
}

/** 一次 D1 往返取回会话用户 + 权限点：D1 单次往返约 0.3s（跨区），拆成三次串行即多付 0.6s */
export interface AuthIdentity {
	user: AuthUser;
	perms: string[];
}

export async function getAuthIdentity(
	request: Request,
	env?: UserSessionEnv,
): Promise<AuthIdentity | null> {
	const token = getCookieValue(
		request.headers.get("Cookie"),
		USER_SESSION_COOKIE,
	);
	if (!token) return null;

	const payload = await getSessionPayload(token, env);
	if (!payload) return null;

	const db = (env as CloudflareEnv | undefined)?.DB;
	if (!db) return null;

	// password 与 perms 同库同行取回：密码指纹用于吊销校验，权限点用于后台鉴权，
	// 三者分三次查是同一行数据的重复往返
	let row: (AuthUser & { password: string; perms: string | null }) | null;
	try {
		row = await db
			.prepare(
				`SELECT id, email, email_verified, name, avatar, bio, role, banned, created_at, password,
         (SELECT group_concat(perm) FROM user_permissions WHERE user_id = users.id) AS perms
         FROM users WHERE id = ?`,
			)
			.bind(payload.u)
			.first<AuthUser & { password: string; perms: string | null }>();
	} catch {
		return null;
	}
	if (!row) return null;
	if (row.banned === 1) return null;

	const fp = (await sha256Hex(row.password ?? "")).slice(0, 16);
	if (!payload.v || payload.v !== fp) return null;

	const { password: _password, perms, ...user } = row;
	return {
		user: user as AuthUser,
		perms: perms ? perms.split(",") : [],
	};
}

export async function getAuthUser(
	request: Request,
	env?: UserSessionEnv,
): Promise<AuthUser | null> {
	return (await getAuthIdentity(request, env))?.user ?? null;
}

/** 校验 profile 更新字段；null 表示通过。未提供（undefined）的字段跳过。 */
export function validateProfilePatch(patch: {
	name?: string;
	avatar?: string;
	bio?: string;
}): string | null {
	if (patch.name !== undefined) {
		const v = patch.name.trim();
		if (!v) return "昵称不能为空";
		if (v.length > 30) return "昵称最多 30 个字符";
	}
	if (patch.avatar !== undefined) {
		const v = patch.avatar.trim();
		if (v.length > 500) return "头像地址过长";
		if (v && !v.startsWith("/") && !/^https?:\/\/[^\s]+$/i.test(v))
			return "头像地址需为站内路径或 http(s) 链接";
	}
	if (patch.bio !== undefined) {
		const v = patch.bio.trim();
		if (v.length > 500) return "个人简介最多 500 字";
	}
	return null;
}

// 写请求准入与会话校验同属一层，路由侧统一从本模块取，避免两处各写一份 Origin 判定
export { isSameOriginRequest, originForbiddenResponse } from "../utils/csrf";
export { hashPassword, isBcryptHash } from "./password";

export async function verifyPassword(
	password: string,
	hash: string,
	onUpgrade?: (newHash: string) => Promise<void>,
): Promise<boolean> {
	return verifyPasswordAllowPlaintext(
		password,
		hash,
		onUpgrade ?? (async () => {}),
		BCRYPT_ROUNDS,
	);
}

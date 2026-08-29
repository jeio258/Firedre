/**
 * Firedre 管理员认证模块
 *
 * 功能：
 * - Session Cookie 管理（HttpOnly + SameSite=Lax）
 * - Bearer Token 认证
 * - 密码哈希验证（使用 bcrypt）
 * - HMAC 会话令牌签名
 */

import bcrypt from "bcryptjs";
import type { CloudflareEnv } from "../../types/env";
import { constantTimeEqual } from "../utils/timingSafe";
import { getAdminEnvFromProcess, loadAdminEnv } from "./loadAdminEnv";

export const ADMIN_SESSION_COOKIE = "admin_session";
/** 单次管理会话有效时长（离开 /admin 后会清除 Cookie） */
export const ADMIN_SESSION_MAX_AGE = 60 * 60 * 4; // 4 hours
/** 登录失败锁定时间 */
export const LOGIN_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes
/** 最大尝试次数 */
export const LOGIN_MAX_ATTEMPTS = 5;
/** bcrypt 工作因子 */
export const BCRYPT_ROUNDS = 10;

export interface AdminAuthEnv {
	ADMIN_USERNAME?: string;
	/** 密码哈希（bcrypt）。明文密码已废弃，首次登录时自动升级。 */
	ADMIN_PASSWORD?: string;
	ADMIN_API_TOKEN?: string;
	/** 会话签名独立密钥（必须配置）。不允许使用弱凭据作为签名密钥。 */
	SESSION_SECRET?: string;
}

/**
 * 会话令牌签名密钥。
 * SESSION_SECRET 是必须配置的独立密钥，不允许降级使用弱凭据。
 * 这是安全硬性要求：使用密码或 Token 作为 HMAC 密钥会显著降低会话伪造难度。
 */
function getSecret(env: AdminAuthEnv): string {
	const secret = env.SESSION_SECRET?.trim();
	if (!secret) {
		throw new Error(
			"SESSION_SECRET 未配置。出于安全考虑，不允许使用 ADMIN_PASSWORD 或 ADMIN_API_TOKEN 作为会话签名密钥。请在 Cloudflare Secrets 中设置 SESSION_SECRET。",
		);
	}
	return secret;
}

function base64urlEncode(input: string) {
	if (typeof btoa === "function")
		return btoa(input)
			.replace(/\+/g, "-")
			.replace(/\//g, "_")
			.replace(/=+$/, "");

	return Buffer.from(input, "utf8").toString("base64url");
}

function base64urlDecode(input: string) {
	const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
	const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);

	if (typeof atob === "function") return atob(padded);

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
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);

	if (typeof btoa === "function")
		return btoa(binary)
			.replace(/\+/g, "-")
			.replace(/\//g, "_")
			.replace(/=+$/, "");

	return Buffer.from(bytes).toString("base64url");
}

export async function createSessionToken(username: string, env: AdminAuthEnv) {
	const secret = getSecret(env);
	if (!secret) throw new Error("未配置 SESSION_SECRET");

	const exp = Date.now() + ADMIN_SESSION_MAX_AGE * 1000;
	const payload = base64urlEncode(JSON.stringify({ u: username, exp }));
	const sig = await hmacSign(payload, secret);
	return `${payload}.${sig}`;
}

export async function verifySessionToken(token: string, env: AdminAuthEnv) {
	const user = await getSessionUser(token, env);
	return Boolean(user);
}

export async function getSessionUser(token: string, env: AdminAuthEnv) {
	const secret = getSecret(env);
	if (!secret || !token) return null;

	const [payload, sig] = token.split(".");
	if (!payload || !sig) return null;

	const expected = await hmacSign(payload, secret);
	if (!constantTimeEqual(expected, sig)) return null;

	try {
		const data = JSON.parse(base64urlDecode(payload)) as {
			u?: string;
			exp?: number;
		};
		if (!data.exp || Date.now() > data.exp) return null;
		return data.u || null;
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
		if (rawKey === name) return decodeURIComponent(rest.join("="));
	}

	return null;
}

export function buildSessionCookie(token: string, secure: boolean) {
	const parts = [
		`${ADMIN_SESSION_COOKIE}=${encodeURIComponent(token)}`,
		"Path=/",
		"HttpOnly",
		"SameSite=Lax",
		`Max-Age=${ADMIN_SESSION_MAX_AGE}`,
	];
	if (secure) parts.push("Secure");
	return parts.join("; ");
}

export function buildClearSessionCookie(secure: boolean) {
	const parts = [
		`${ADMIN_SESSION_COOKIE}=`,
		"Path=/",
		"HttpOnly",
		"SameSite=Lax",
		"Max-Age=0",
	];
	if (secure) parts.push("Secure");
	return parts.join("; ");
}

export function resolveAdminEnv(env?: CloudflareEnv): AdminAuthEnv {
	if (env?.ADMIN_USERNAME || env?.ADMIN_PASSWORD || env?.ADMIN_API_TOKEN)
		return env;

	loadAdminEnv();
	return getAdminEnvFromProcess();
}

/**
 * 验证管理员凭据（仅支持 bcrypt 哈希）
 * 若检测到明文密码，自动升级为 bcrypt 哈希（首次登录时触发）
 */
export async function validateAdminCredentials(
	username: string,
	password: string,
	env: AdminAuthEnv,
): Promise<boolean> {
	if (!isAdminLoginConfigured(env)) return false;

	const expectedUser = env.ADMIN_USERNAME?.trim();
	const storedPassword = env.ADMIN_PASSWORD;
	if (!expectedUser || !storedPassword) return false;

	if (username !== expectedUser) return false;

	// 检查是否为明文密码（已废弃，自动升级）
	if (!isBcryptHash(storedPassword)) {
		// 明文密码：验证后自动升级为 bcrypt 哈希
		// 恒定时间比较（长度恒定规避大部分时序侧信道）；明文仅存在于旧配置升级路径。
		const isMatch = constantTimeEqual(password, storedPassword);
		if (isMatch) {
			try {
				const newHash = await hashPassword(password);
				env.ADMIN_PASSWORD = newHash; // 仅内存升级，持久化由调用方处理
				// 注意：实际持久化需要在调用方（如 API 路由）中通过 DB 更新
			} catch {
				// 升级失败不影响登录，但应在日志中记录
			}
		}
		return isMatch;
	}

	// bcrypt 哈希验证
	return bcrypt.compare(password, storedPassword);
}

/**
 * 判断密码是否为 bcrypt 哈希。
 * bcrypt 哈希以 $2$、$2a$、$2b$ 或 $2y$ 开头，长度固定为 60 字符。
 *
 * 注意：该判定与 bcrypt 实现强耦合 —— 若未来改用 bcrypt-sha256 / argon2 / scrypt
 * 等变体，前缀或长度校验会误判为明文（进入自动升级路径）。升级算法时需同步更新此函数。
 */
export function isBcryptHash(password: string): boolean {
	return (
		(password.startsWith("$2$") ||
			password.startsWith("$2a$") ||
			password.startsWith("$2b$") ||
			password.startsWith("$2y$")) &&
		password.length === 60
	);
}

/**
 * 生成 bcrypt 哈希
 */
export async function hashPassword(password: string): Promise<string> {
	return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * 检查是否已配置管理员登录
 */
export function isAdminLoginConfigured(env: AdminAuthEnv) {
	return Boolean(env.ADMIN_USERNAME?.trim() && env.ADMIN_PASSWORD);
}

export async function verifyAdminRequest(
	request: Request,
	env?: CloudflareEnv,
) {
	const adminEnv = resolveAdminEnv(env);
	const configuredToken = adminEnv.ADMIN_API_TOKEN?.trim();
	const bearer = request.headers.get("Authorization") || "";
	const bearerToken = bearer.startsWith("Bearer ")
		? bearer.slice(7).trim()
		: "";
	if (configuredToken && bearerToken === configuredToken) return true;

	const token = getCookieValue(
		request.headers.get("Cookie"),
		ADMIN_SESSION_COOKIE,
	);
	if (!token) return false;

	return verifySessionToken(token, adminEnv);
}

export async function verifyAdminHeaders(
	headers: { authorization?: string | null; cookie?: string | null },
	env?: CloudflareEnv,
) {
	const adminEnv = resolveAdminEnv(env);
	const configuredToken = adminEnv.ADMIN_API_TOKEN?.trim();
	const bearer = headers.authorization || "";
	const bearerToken = bearer.startsWith("Bearer ")
		? bearer.slice(7).trim()
		: "";
	if (configuredToken && bearerToken === configuredToken) return true;

	const token = getCookieValue(headers.cookie || null, ADMIN_SESSION_COOKIE);
	if (!token) return false;

	return verifySessionToken(token, adminEnv);
}

/**
 * 导出供测试使用
 */
export const authExports = {
	getSecret,
	isBcryptHash,
	createSessionToken,
	verifySessionToken,
	getSessionUser,
	buildSessionCookie,
	buildClearSessionCookie,
	validateAdminCredentials,
};

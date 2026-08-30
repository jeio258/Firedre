/**
 * Firedre 管理员认证模块
 *
 * 功能：
 * - Session Cookie 管理（HttpOnly + SameSite=Lax）
 * - HMAC 会话令牌签名
 * - 密码哈希验证（bcrypt，唯一管理员存 D1）
 */

import bcrypt from "bcryptjs";
import type { CloudflareEnv } from "../../types/env";
import { constantTimeEqual } from "../utils/timingSafe";
import { getAdminEnvFromProcess, loadAdminEnv } from "./loadAdminEnv";

export const ADMIN_SESSION_COOKIE = "admin_session";
/** 单次管理会话有效时长（离开 /admin 后会清除 Cookie） */
export const ADMIN_SESSION_MAX_AGE = 60 * 60 * 4; // 4 hours
/** bcrypt 工作因子 */
export const BCRYPT_ROUNDS = 10;

export interface AdminAuthEnv {
	/** 会话签名独立密钥（必须配置，不允许降级使用弱凭据） */
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
			"SESSION_SECRET 未配置。该密钥是会话签名密钥，后台无法登录。请在 Cloudflare Secrets 中设置 SESSION_SECRET。",
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
	if (env?.SESSION_SECRET) return env;

	loadAdminEnv();
	return getAdminEnvFromProcess();
}

/**
 * 判断密码是否为 bcrypt 哈希。
 * bcrypt 哈希以 $2$、$2a$、$2b$ 或 $2y$ 开头，长度固定为 60 字符。
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

export async function verifyAdminRequest(
	request: Request,
	env?: CloudflareEnv,
) {
	const token = getCookieValue(
		request.headers.get("Cookie"),
		ADMIN_SESSION_COOKIE,
	);
	if (!token) return false;

	const adminEnv = resolveAdminEnv(env);
	const username = await getSessionUser(token, adminEnv);
	if (!username) return false;

	// D1 凭据权威：若该用户在 D1 中存在但已被禁用 → 会话立即失效（禁用即时生效）。
	if (env?.DB) {
		try {
			const row = await env.DB.prepare(
				"SELECT enabled FROM admin_users WHERE username = ?",
			)
				.bind(username)
				.first<{ enabled: number }>();
			if (row && row.enabled !== 1) return false;
		} catch {
			// DB 查询失败不阻断
		}
	}

	return true;
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
};

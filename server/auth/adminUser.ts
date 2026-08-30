/**
 * Firedre 后台管理员用户（D1 存储）
 *
 * 凭据权威迁移：原 ADMIN_USERNAME/ADMIN_PASSWORD 存 Cloudflare Secrets，
 * 现迁至 D1 表 admin_users。本模块提供用户的查询/创建/改密/启禁用，
 * 供登录校验与后台「用户管理」页调用。bcrypt 哈希存储，SESSION_SECRET 不落库。
 */

import type { CloudflareEnv } from "../../types/env";
import bcrypt from "bcryptjs";
import {
	hashPassword,
	isBcryptHash,
	validateAdminCredentials,
} from "./adminSession";

export interface AdminUserRow {
	id: number;
	username: string;
	password_hash: string;
	enabled: number;
	created_at: string;
	updated_at: string;
}

/** 后台用户管理返回结构（剔除 password_hash，前端不暴露哈希） */
export interface AdminUserPublic {
	id: number;
	username: string;
	enabled: boolean;
	created_at: string;
}

export function toPublicUser(row: AdminUserRow): AdminUserPublic {
	return {
		id: row.id,
		username: row.username,
		enabled: row.enabled === 1,
		created_at: row.created_at,
	};
}

/** 按用户名查询用户（含哈希，仅服务端内部使用） */
export async function getAdminUserByUsername(
	db: D1Database,
	username: string,
): Promise<AdminUserRow | null> {
	if (!username) return null;
	const row = await db
		.prepare(
			"SELECT id, username, password_hash, enabled, created_at, updated_at FROM admin_users WHERE username = ?",
		)
		.bind(username.trim())
		.first<AdminUserRow>();
	return row ?? null;
}

/** 校验用户名密码（bcrypt），并检查用户是否启用 */
export async function verifyAdminUserCredentials(
	db: D1Database,
	username: string,
	password: string,
): Promise<boolean> {
	const user = await getAdminUserByUsername(db, username);
	if (!user) return false;
	if (user.enabled !== 1) return false;
	return bcrypt.compare(password, user.password_hash);
}

/** 创建用户（返回冲突状态） */
export async function createAdminUser(
	db: D1Database,
	username: string,
	password: string,
): Promise<{ ok: true } | { ok: false; conflict: boolean }> {
	const name = String(username || "").trim();
	if (!name || !password) return { ok: false, conflict: false };

	const existing = await getAdminUserByUsername(db, name);
	if (existing) return { ok: false, conflict: true };

	const hash = await hashPassword(password);
	await db
		.prepare(
			"INSERT INTO admin_users (username, password_hash, enabled) VALUES (?, ?, 1)",
		)
		.bind(name, hash)
		.run();
	return { ok: true };
}

/** 修改密码 */
export async function updateAdminUserPassword(
	db: D1Database,
	username: string,
	password: string,
): Promise<boolean> {
	const name = String(username || "").trim();
	if (!name || !password) return false;
	const user = await getAdminUserByUsername(db, name);
	if (!user) return false;
	const hash = await hashPassword(password);
	await db
		.prepare(
			"UPDATE admin_users SET password_hash = ?, updated_at = datetime('now') WHERE username = ?",
		)
		.bind(hash, name)
		.run();
	return true;
}

/** 启用/禁用用户 */
export async function setAdminUserEnabled(
	db: D1Database,
	username: string,
	enabled: boolean,
): Promise<boolean> {
	const name = String(username || "").trim();
	if (!name) return false;
	const existing = await getAdminUserByUsername(db, name);
	if (!existing) return false;
	await db
		.prepare(
			"UPDATE admin_users SET enabled = ?, updated_at = datetime('now') WHERE username = ?",
		)
		.bind(enabled ? 1 : 0, name)
		.run();
	return true;
}

/** 删除用户 */
export async function deleteAdminUser(
	db: D1Database,
	username: string,
): Promise<boolean> {
	const name = String(username || "").trim();
	if (!name) return false;
	const existing = await getAdminUserByUsername(db, name);
	if (!existing) return false;
	await db.prepare("DELETE FROM admin_users WHERE username = ?").bind(name).run();
	return true;
}

/** 列出所有用户（公开结构） */
export async function listAdminUsers(
	db: D1Database,
): Promise<AdminUserPublic[]> {
	const { results } = await db
		.prepare(
			"SELECT id, username, password_hash, enabled, created_at, updated_at FROM admin_users ORDER BY id ASC",
		)
		.all<AdminUserRow>();
	return (results || []).map(toPublicUser);
}

/**
 * 登录时若 D1 无该用户、但 Secrets 旧凭据校验通过 → 自动落库为 admin 用户（平滑迁移）。
 * 返回新写入的用户名；未触发迁移返回 null。
 */
/**
 * 登录鉴权编排（D1 优先，Secrets 兜底 + 平滑迁移）：
 * 1. D1 有该用户 → bcrypt + enabled 校验；
 * 2. D1 无该用户 → 回落旧 Secrets 凭据校验；
 * 3. Secrets 校验通过且 D1 表仍无此用户 → 自动落库为 admin 用户（迁移后以 D1 为准）。
 */
export async function authenticateAdmin(
	env: CloudflareEnv,
	db: D1Database,
	username: string,
	password: string,
): Promise<boolean> {
	const name = String(username || "").trim();
	if (!name) return false;

	// 1. D1 优先
	const existing = await getAdminUserByUsername(db, name);
	if (existing) return verifyAdminUserCredentials(db, name, password);

	// 2. Secrets 兜底
	const ok = await validateAdminCredentials(name, password, env);
	if (!ok) return false;

	// 3. 平滑迁移：落库为 admin 用户（密码哈希来自 Secrets；明文则先升级为 bcrypt）
	let hash = env.ADMIN_PASSWORD;
	if (!hash || !isBcryptHash(hash)) hash = await hashPassword(password);
	await seedAdminUserFromSecrets(env, db, name, hash);
	return true;
}

export async function seedAdminUserFromSecrets(
	env: CloudflareEnv,
	db: D1Database,
	username: string,
	passwordHash: string,
): Promise<string | null> {
	const name = String(username || "").trim();
	if (!name) return null;
	const existing = await getAdminUserByUsername(db, name);
	if (existing) return null;
	await db
		.prepare(
			"INSERT INTO admin_users (username, password_hash, enabled) VALUES (?, ?, 1) ON CONFLICT(username) DO NOTHING",
		)
		.bind(name, passwordHash)
		.run();
	// 重新查询确认是否真正落库（幂等：并发/已存在时不再覆盖）
	return (await getAdminUserByUsername(db, name)) ? name : null;
}

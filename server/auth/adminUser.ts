/**
 * Firedre 后台管理员用户（D1 存储，单用户模型）
 *
 * 凭据权威在 D1 表 admin_users，不再依赖 Secrets 的用户名/密码。
 * 设计约束：
 * - 系统只有一个管理员（首个创建的用户即管理员）；
 * - 尚未创建管理员时，任何人都可创建（初始化流程）；创建后禁止再建第二个用户；
 * - 只允许修改密码，不支持启用/禁用/删除/多用户。
 * bcrypt 哈希存储，SESSION_SECRET 不落库。
 */

import type { CloudflareEnv } from "../../types/env";
import bcrypt from "bcryptjs";
import { hashPassword } from "./adminSession";

export interface AdminUserRow {
	id: number;
	username: string;
	password_hash: string;
	enabled: number;
	created_at: string;
	updated_at: string;
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

/** 系统是否已创建管理员（初始化状态判断） */
export async function hasAdminUser(db: D1Database): Promise<boolean> {
	const row = await db
		.prepare("SELECT COUNT(*) AS c FROM admin_users")
		.first<{ c: number }>();
	return Boolean(row && Number(row.c) > 0);
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

/**
 * 创建管理员。仅当系统尚无任何管理员时允许（首个用户即管理员）。
 * 返回冲突状态：conflict=true 表示已有管理员，禁止再创建。
 */
export async function createAdminUser(
	db: D1Database,
	username: string,
	password: string,
): Promise<{ ok: true } | { ok: false; conflict: boolean }> {
	const name = String(username || "").trim();
	if (!name || !password) return { ok: false, conflict: false };

	// 已有管理员 → 拒绝（单用户模型）
	if (await hasAdminUser(db)) return { ok: false, conflict: true };

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

/**
 * 登录鉴权：D1 唯一管理员的 bcrypt + enabled 校验。
 * 不再有 Secrets 兜底；D1 无用户时直接返回 false（前端引导初始化）。
 */
export async function authenticateAdmin(
	env: CloudflareEnv,
	db: D1Database,
	username: string,
	password: string,
): Promise<boolean> {
	return verifyAdminUserCredentials(db, username, password);
}

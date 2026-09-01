

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

export async function hasAdminUser(db: D1Database): Promise<boolean> {
	const row = await db
		.prepare("SELECT COUNT(*) AS c FROM admin_users")
		.first<{ c: number }>();
	return Boolean(row && Number(row.c) > 0);
}

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

export async function authenticateAdmin(
	env: CloudflareEnv,
	db: D1Database,
	username: string,
	password: string,
): Promise<boolean> {
	return verifyAdminUserCredentials(db, username, password);
}

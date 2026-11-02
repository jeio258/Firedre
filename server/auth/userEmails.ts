import type { CloudflareEnv } from "../../types/env";

/**
 * 用户邮箱别名（0007 user_emails）唯一写入口。
 *
 * 上限约束：一个用户的别名（不含 users.email 主邮箱）最多 MAX_ALIAS_PER_USER 条。
 * 无上限的话，OAuth 自动绑定或未来的管理界面一旦出 bug，一个用户可以把表撑爆
 * （每条别名还会参与登录解析，条目过多也会拖慢查重）。
 */
export const MAX_ALIAS_PER_USER = 5;

export type AddUserEmailResult =
	| { ok: true; duplicated: boolean }
	| { ok: false; reason: "limit_reached" | "invalid" };

/** 归一化：小写 + 去空格。格式校验沿用 register 的 isValidEmail。 */
export function normalizeAliasEmail(raw: string): string {
	return String(raw || "")
		.trim()
		.toLowerCase();
}

export async function addUserEmail(
	db: CloudflareEnv["DB"],
	userId: string,
	rawEmail: string,
	opts: { verified?: boolean } = {},
): Promise<AddUserEmailResult> {
	const { isValidEmail } = await import("./register");
	const email = normalizeAliasEmail(rawEmail);
	if (!isValidEmail(email)) return { ok: false, reason: "invalid" };
	if (email.length > 254) return { ok: false, reason: "invalid" };

	// 与主邮箱重复 → 视为已存在（幂等成功）
	const self = await db
		.prepare("SELECT id FROM users WHERE email = ?")
		.bind(email)
		.first<{ id: string }>();
	if (self?.id === userId) return { ok: true, duplicated: true };
	if (self) return { ok: false, reason: "invalid" };

	// 已有别名重复 → 幂等成功
	const existing = await db
		.prepare("SELECT user_id FROM user_emails WHERE email = ?")
		.bind(email)
		.first<{ user_id: string }>();
	if (existing) {
		if (existing.user_id === userId) return { ok: true, duplicated: true };
		// 该邮箱已属于别的用户（users.email 或别名）→ 拒绝
		return { ok: false, reason: "invalid" };
	}

	const count = await db
		.prepare("SELECT COUNT(*) AS c FROM user_emails WHERE user_id = ?")
		.bind(userId)
		.first<{ c: number }>();
	if ((count?.c ?? 0) >= MAX_ALIAS_PER_USER) {
		return { ok: false, reason: "limit_reached" };
	}

	await db
		.prepare(
			"INSERT INTO user_emails (id, user_id, email, verified) VALUES (?, ?, ?, ?)",
		)
		.bind(crypto.randomUUID(), userId, email, opts.verified ? 1 : 0)
		.run();
	return { ok: true, duplicated: false };
}

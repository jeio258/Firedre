import type { FriendInput, FriendRecord } from "../../types/friends";
import type { CloudflareEnv } from "../../types/env";
import { UserError } from "../utils/userError";

/** 仅允许 http/https 或相对路径，拦截 javascript:/data:/vbscript: 等危险 scheme */
export function isSafeHttpUrl(raw: string): boolean {
	const value = String(raw || "").trim();
	if (!value) return false;
	// 相对地址（/ ./ ../ #）允许
	if (/^(\/|#)/.test(value)) return true;
	// 无 scheme 视为相对路径（如 www.example.com），允许
	if (!/^[a-z][a-z0-9+.-]*:/i.test(value)) return true;
	return /^https?:/i.test(value);
}

function normalizeInput(raw: FriendInput) {
	const title = String(raw.title || "").trim();
	const imgurl = String(raw.imgurl || "").trim();
	const siteurl = String(raw.siteurl || "").trim();

	if (!title) throw new UserError("友链名称不能为空");
	if (!imgurl) throw new UserError("友链头像不能为空");
	if (!siteurl) throw new UserError("友链地址不能为空");

	// 仅允许安全 URL scheme，拦截 javascript:/data:/vbscript: 等存储型 XSS
	if (!isSafeHttpUrl(siteurl)) throw new UserError("友链地址仅支持 http/https 或相对路径");
	if (!isSafeHttpUrl(imgurl)) throw new UserError("友链头像仅支持 http/https 或相对路径");

	const tags = Array.isArray(raw.tags)
		? raw.tags.map((t) => String(t).trim()).filter(Boolean)
		: String(raw.tags || "")
				.split(",")
				.map((t) => t.trim())
				.filter(Boolean);

	const weight = Number.isFinite(Number(raw.weight))
		? Math.max(0, Math.round(Number(raw.weight)))
		: 0;

	return {
		title,
		imgurl,
		desc: String(raw.desc || "").trim(),
		siteurl,
		tags: tags.slice(0, 20),
		weight,
		enabled: raw.enabled === false ? 0 : 1,
	};
}

/** 前台展示：仅启用且按权重降序 */
export async function listEnabledFriends(
	env: CloudflareEnv,
): Promise<FriendRecord[]> {
	const { results } = await env.DB.prepare(`
    SELECT * FROM friends
    WHERE enabled = 1
    ORDER BY weight DESC, id ASC
  `).all<FriendRecord>();
	return results || [];
}

/** 后台管理：全部友链，按权重降序 */
export async function listFriends(
	env: CloudflareEnv,
): Promise<FriendRecord[]> {
	const { results } = await env.DB.prepare(`
    SELECT * FROM friends
    ORDER BY weight DESC, id ASC
  `).all<FriendRecord>();
	return results || [];
}

export async function getFriend(
	env: CloudflareEnv,
	id: number,
): Promise<FriendRecord | null> {
	return env.DB.prepare("SELECT * FROM friends WHERE id = ?")
		.bind(id)
		.first<FriendRecord>();
}

export async function createFriend(
	env: CloudflareEnv,
	raw: FriendInput,
) {
	const input = normalizeInput(raw);
	const result = await env.DB.prepare(`
    INSERT INTO friends (title, imgurl, desc, siteurl, tags, weight, enabled, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `)
		.bind(
			input.title,
			input.imgurl,
			input.desc,
			input.siteurl,
			input.tags.join(","),
			input.weight,
			input.enabled,
		)
		.run();

	const id = Number(result.meta.last_row_id);
	return getFriend(env, id);
}

export async function updateFriend(
	env: CloudflareEnv,
	id: number,
	raw: FriendInput,
) {
	const exists = await getFriend(env, id);
	if (!exists) throw new UserError("友链不存在");

	const input = normalizeInput(raw);
	await env.DB.prepare(`
    UPDATE friends SET
      title = ?, imgurl = ?, desc = ?, siteurl = ?, tags = ?,
      weight = ?, enabled = ?, updated_at = datetime('now')
    WHERE id = ?
  `)
		.bind(
			input.title,
			input.imgurl,
			input.desc,
			input.siteurl,
			input.tags.join(","),
			input.weight,
			input.enabled,
			id,
		)
		.run();

	return getFriend(env, id);
}

export async function deleteFriend(env: CloudflareEnv, id: number) {
	const result = await env.DB.prepare("DELETE FROM friends WHERE id = ?")
		.bind(id)
		.run();
	return result.meta.changes > 0;
}

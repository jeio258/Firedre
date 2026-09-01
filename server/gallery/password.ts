import type { CloudflareEnv } from "../../types/env";

/**
 * 相册访问密码存储（D1）。
 *
 * 设计：相册 index.md 的 frontmatter 只保留 `encrypted: true` 标记，
 * 密码明文存于此表（与 dynamics 一样走 D1 存储），避免密码写进 R2 文件
 * 导致公开 API / R2 泄漏。SSR 渲染 EncryptedContent 需要明文加密内容，
 * 解锁/图片校验也读取此处做恒定时间比对。
 */

export async function getAlbumPassword(
	env: CloudflareEnv,
	slug: string,
): Promise<string> {
	if (!slug) return "";
	const row = await env.DB.prepare(
		"SELECT password FROM album_passwords WHERE album_slug = ?",
	)
		.bind(slug)
		.first<{ password: string }>();
	return row?.password ?? "";
}

export async function setAlbumPassword(
	env: CloudflareEnv,
	slug: string,
	password: string,
): Promise<void> {
	if (!slug) return;
	const trimmed = String(password || "").trim();
	if (!trimmed) {
		await env.DB.prepare(
			"DELETE FROM album_passwords WHERE album_slug = ?",
		).bind(slug).run();
		return;
	}
	await env.DB.prepare(
		`INSERT INTO album_passwords (album_slug, password, updated_at)
		 VALUES (?, ?, datetime('now'))
		 ON CONFLICT(album_slug) DO UPDATE SET password = excluded.password, updated_at = datetime('now')`,
	)
		.bind(slug, trimmed)
		.run();
}

export async function deleteAlbumPassword(
	env: CloudflareEnv,
	slug: string,
): Promise<void> {
	if (!slug) return;
	await env.DB.prepare(
		"DELETE FROM album_passwords WHERE album_slug = ?",
	).bind(slug).run();
}

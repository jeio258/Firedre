/**
 * 相册 WebDAV 源配置（D1 存储）。
 *
 * 设计：相册 index.md 的 frontmatter 只保留 `source: webdav` 标记，
 * url/username 存于本表（album_webdav）。与 album_passwords 一致走 D1 存储，
 * 避免 WebDAV 服务器地址/账号写进 R2 文件。登录密码（WEBDAV_PASSWORD）恒走环境变量。
 */

import type { CloudflareEnv } from "../../types/env";

export interface AlbumWebDavConfigRow {
	album_slug: string;
	url: string;
	username: string | null;
	updated_at: string;
}

/** 读取 WebDAV 配置（无则返回 null） */
export async function getAlbumWebDavConfig(
	env: CloudflareEnv,
	slug: string,
): Promise<{ url: string; username?: string } | null> {
	if (!slug) return null;
	const row = await env.DB.prepare(
		"SELECT album_slug, url, username, updated_at FROM album_webdav WHERE album_slug = ?",
	)
		.bind(slug)
		.first<AlbumWebDavConfigRow>();
	if (!row) return null;
	return {
		url: row.url,
		...(row.username ? { username: row.username } : {}),
	};
}

/** 写入 WebDAV 配置（upsert） */
export async function setAlbumWebDavConfig(
	env: CloudflareEnv,
	slug: string,
	url: string,
	username?: string,
): Promise<void> {
	if (!slug) return;
	const trimmedUrl = String(url || "").trim();
	if (!trimmedUrl) {
		await deleteAlbumWebDavConfig(env, slug);
		return;
	}
	await env.DB.prepare(
		`INSERT INTO album_webdav (album_slug, url, username, updated_at)
		 VALUES (?, ?, ?, datetime('now'))
		 ON CONFLICT(album_slug) DO UPDATE SET
		   url = excluded.url,
		   username = excluded.username,
		   updated_at = datetime('now')`,
	)
		.bind(slug, trimmedUrl, String(username || "").trim() || null)
		.run();
}

/** 删除 WebDAV 配置 */
export async function deleteAlbumWebDavConfig(
	env: CloudflareEnv,
	slug: string,
): Promise<void> {
	if (!slug) return;
	await env.DB.prepare("DELETE FROM album_webdav WHERE album_slug = ?")
		.bind(slug)
		.run();
}

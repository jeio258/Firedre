

import type { CloudflareEnv } from "../../types/env";

export interface AlbumWebDavConfigRow {
	album_slug: string;
	url: string;
	username: string | null;
	updated_at: string;
}

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

export async function deleteAlbumWebDavConfig(
	env: CloudflareEnv,
	slug: string,
): Promise<void> {
	if (!slug) return;
	await env.DB.prepare("DELETE FROM album_webdav WHERE album_slug = ?")
		.bind(slug)
		.run();
}

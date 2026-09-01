import type { CloudflareEnv } from "../../types/env";

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

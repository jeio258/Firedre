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

export async function getAlbumPasswordsMap(
	env: CloudflareEnv,
	slugs: string[],
): Promise<Map<string, string>> {
	const map = new Map<string, string>();
	const valid = [...new Set(slugs.filter(Boolean))];
	if (!valid.length) return map;

	const CHUNK = 100;
	for (let i = 0; i < valid.length; i += CHUNK) {
		const chunk = valid.slice(i, i + CHUNK);
		const placeholders = chunk.map(() => "?").join(",");
		const { results } = await env.DB.prepare(
			`SELECT album_slug, password FROM album_passwords WHERE album_slug IN (${placeholders})`,
		)
			.bind(...chunk)
			.all<{ album_slug: string; password: string }>();
		for (const row of results || []) map.set(row.album_slug, row.password);
	}
	return map;
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

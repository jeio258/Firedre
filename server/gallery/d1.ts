

import type {
	AlbumDetailFrontmatter,
	AlbumSource,
} from "../../types/album";
import type { CloudflareEnv } from "../../types/env";

interface AlbumRow {
	slug: string;
	title: string;
	desc: string | null;
	date: string | null;
	location: string | null;
	tags: string | null; // JSON 数组
	cover: string | null;
	encrypted: number;
	password_hint: string | null;
	source: string;
	content: string;
}

interface AlbumPhotoRow {
	url: string;
	type: string | null;
	poster: string | null;
	date: string | null;
	sort_order: number;
}

export interface AlbumD1Data {
	frontmatter: AlbumDetailFrontmatter;
	content: string;
}

function parseTags(raw: string | null): string[] | undefined {
	if (!raw) return undefined;
	try {
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed.map(String) : undefined;
	} catch {
		return undefined;
	}
}

function parseSource(raw: string): AlbumSource {
	return raw === "webdav" ? "webdav" : "local";
}

export async function getAlbumFromD1(
	env: CloudflareEnv,
	slug: string,
): Promise<AlbumD1Data | null> {
	const row = await env.DB.prepare("SELECT * FROM albums WHERE slug = ?")
		.bind(slug)
		.first<AlbumRow>();
	if (!row) return null;

	const photos = await loadPhotos(env, slug);

	const frontmatter: AlbumDetailFrontmatter = {
		title: row.title || undefined,
		cover: row.cover || undefined,
		desc: row.desc || undefined,
		date: row.date || undefined,
		location: row.location || undefined,
		tags: parseTags(row.tags),
		encrypted: row.encrypted === 1,
		source: parseSource(row.source),
	};
	if (row.password_hint) frontmatter.password = row.password_hint;

	if (frontmatter.source === "local") {
		frontmatter.photos = photos.map((p) => ({
			url: p.url,
			...(p.date ? { date: p.date } : {}),
			...(p.type === "video" || p.type === "image"
				? { type: p.type as "video" | "image" }
				: {}),
			...(p.poster ? { poster: p.poster } : {}),
		}));
	}

	return { frontmatter, content: row.content };
}

async function loadPhotos(
	env: CloudflareEnv,
	slug: string,
): Promise<AlbumPhotoRow[]> {
	const { results } = await env.DB.prepare(
		"SELECT url, type, poster, date, sort_order FROM album_photos WHERE album_slug = ? ORDER BY sort_order ASC, id ASC",
	)
		.bind(slug)
		.all<AlbumPhotoRow>();
	return results || [];
}

export async function upsertAlbumToD1(
	env: CloudflareEnv,
	slug: string,
	frontmatter: AlbumDetailFrontmatter,
	content: string,
): Promise<AlbumD1Data> {
	const tagsJson = Array.isArray(frontmatter.tags)
		? JSON.stringify(frontmatter.tags.map(String))
		: null;
	const source = frontmatter.source === "webdav" ? "webdav" : "local";

	await env.DB.prepare(
		`INSERT INTO albums (slug, title, desc, date, location, tags, cover, encrypted, password_hint, source, content)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		 ON CONFLICT(slug) DO UPDATE SET
		   title = excluded.title,
		   desc = excluded.desc,
		   date = excluded.date,
		   location = excluded.location,
		   tags = excluded.tags,
		   cover = excluded.cover,
		   encrypted = excluded.encrypted,
		   password_hint = excluded.password_hint,
		   source = excluded.source,
		   content = excluded.content,
		   updated_at = datetime('now')`,
	)
		.bind(
			slug,
			frontmatter.title || "",
			frontmatter.desc || null,
			frontmatter.date || null,
			frontmatter.location || null,
			tagsJson,
			frontmatter.cover || null,
			frontmatter.encrypted === true ? 1 : 0,
			frontmatter.password || null,
			source,
			content,
		)
		.run();

	await env.DB.prepare("DELETE FROM album_photos WHERE album_slug = ?")
		.bind(slug)
		.run();

	const photos = Array.isArray(frontmatter.photos) ? frontmatter.photos : [];
	for (let i = 0; i < photos.length; i++) {
		const p = photos[i];
		await env.DB.prepare(
			"INSERT INTO album_photos (album_slug, url, type, poster, date, sort_order) VALUES (?, ?, ?, ?, ?, ?)",
		)
			.bind(
				slug,
				p.url,
				p.type === "video" || p.type === "image" ? p.type : null,
				p.poster || null,
				p.date || null,
				i,
			)
			.run();
	}

	return { frontmatter: { ...frontmatter, source }, content };
}

export async function deleteAlbumFromD1(env: CloudflareEnv, slug: string) {
	await env.DB.prepare("DELETE FROM albums WHERE slug = ?").bind(slug).run();
}

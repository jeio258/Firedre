

import type {
	AlbumDetailFrontmatter,
	AlbumSource,
} from "../../types/album";
import type { CloudflareEnv } from "../../types/env";
import { runDbBatch } from "../utils/dbBatch";
import { chunkArray, uniqueNonEmpty } from "../utils/collections";
import { parseStringList } from "../utils/json";

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

function parseSource(raw: string): AlbumSource {
	return raw === "webdav" ? "webdav" : "local";
}

function buildAlbumFrontmatter(
	row: AlbumRow,
	photos: AlbumPhotoRow[],
): AlbumDetailFrontmatter {
	const frontmatter: AlbumDetailFrontmatter = {
		title: row.title || undefined,
		cover: row.cover || undefined,
		desc: row.desc || undefined,
		date: row.date || undefined,
		location: row.location || undefined,
		tags: parseStringList(row.tags),
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
	return frontmatter;
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
	return { frontmatter: buildAlbumFrontmatter(row, photos), content: row.content };
}

export async function getAlbumsFromD1Map(
	env: CloudflareEnv,
	slugs: string[],
): Promise<Map<string, AlbumD1Data>> {
	const map = new Map<string, AlbumD1Data>();
	const valid = uniqueNonEmpty(slugs);
	if (!valid.length) return map;

	const rows: AlbumRow[] = [];
	const photos: (AlbumPhotoRow & { album_slug: string })[] = [];
	for (const chunk of chunkArray(valid)) {
		const placeholders = chunk.map(() => "?").join(",");
		const albumRes = await env.DB.prepare(
			`SELECT * FROM albums WHERE slug IN (${placeholders})`,
		)
			.bind(...chunk)
			.all<AlbumRow>();
		rows.push(...(albumRes.results || []));
		const photoRes = await env.DB.prepare(
			`SELECT album_slug, url, type, poster, date, sort_order FROM album_photos WHERE album_slug IN (${placeholders}) ORDER BY sort_order ASC, id ASC`,
		)
			.bind(...chunk)
			.all<AlbumPhotoRow & { album_slug: string }>();
		photos.push(...(photoRes.results || []));
	}

	const photosBySlug = new Map<string, AlbumPhotoRow[]>();
	for (const p of photos) {
		const list = photosBySlug.get(p.album_slug) ?? [];
		list.push(p);
		photosBySlug.set(p.album_slug, list);
	}

	for (const row of rows) {
		map.set(row.slug, {
			frontmatter: buildAlbumFrontmatter(row, photosBySlug.get(row.slug) ?? []),
			content: row.content,
		});
	}
	return map;
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

	const albumUpsert = env.DB.prepare(
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
	).bind(
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
	);

	const photoDelete = env.DB.prepare(
		"DELETE FROM album_photos WHERE album_slug = ?",
	).bind(slug);

	const photos = Array.isArray(frontmatter.photos) ? frontmatter.photos : [];
	const photoInserts = photos.map((p, i) =>
		env.DB.prepare(
			"INSERT INTO album_photos (album_slug, url, type, poster, date, sort_order) VALUES (?, ?, ?, ?, ?, ?)",
		).bind(
			slug,
			p.url,
			p.type === "video" || p.type === "image" ? p.type : null,
			p.poster || null,
			p.date || null,
			i,
		),
	);

	const stmts = [albumUpsert, photoDelete, ...photoInserts];
	for (let i = 0; i < stmts.length; i += 50) {
		await runDbBatch(env.DB, stmts.slice(i, i + 50));
	}

	return { frontmatter: { ...frontmatter, source }, content };
}

export async function deleteAlbumFromD1(env: CloudflareEnv, slug: string) {
	await env.DB.prepare("DELETE FROM albums WHERE slug = ?").bind(slug).run();
}

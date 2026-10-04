import type { AlbumDetailFrontmatter, AlbumSource } from "../../types/album";
import type { CloudflareEnv } from "../../types/env";
import { chunkArray, uniqueNonEmpty } from "../utils/collections";
import { runDbBatch } from "../utils/dbBatch";
import { parseStringList } from "../utils/json";
import { getAlbumPassword, getAlbumPasswordsMap } from "./password";

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
	// 口令不再从 password_hint（已废弃明文列）回填，由调用方经 album_passwords 解密注入

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
	const frontmatter = buildAlbumFrontmatter(row, photos);
	// 编辑回显口令从加密表解密注入（password_hint 不再存口令）
	const pwd = await getAlbumPassword(env, slug);
	if (pwd) frontmatter.password = pwd;
	return { frontmatter, content: row.content };
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

	// 编辑回显口令从加密表批量解密注入（password_hint 不再存口令）
	const pwdMap = await getAlbumPasswordsMap(env, valid);
	for (const row of rows) {
		const fm = buildAlbumFrontmatter(row, photosBySlug.get(row.slug) ?? []);
		const pwd = pwdMap.get(row.slug);
		if (pwd) fm.password = pwd;
		map.set(row.slug, { frontmatter: fm, content: row.content });
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

	// password_hint 列不再承载口令（安全：D1 泄露不暴露明文），恒写 NULL；
	// 口令由调用方经 setAlbumPassword 加密写入 album_passwords
	const albumUpsert = env.DB.prepare(
		`INSERT INTO albums (slug, title, desc, date, location, tags, cover, encrypted, password_hint, source, content)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
		 ON CONFLICT(slug) DO UPDATE SET
		   title = excluded.title,
		   desc = excluded.desc,
		   date = excluded.date,
		   location = excluded.location,
		   tags = excluded.tags,
		   cover = excluded.cover,
		   encrypted = excluded.encrypted,
		   password_hint = NULL,
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
	// D1 batch 原子性以单次 batch 为界：分片越小，跨片失败造成照片残缺的窗口越大；
	// 100 条（覆盖约 98 张照片的相册）可在单 batch 内完成删除+重建
	for (let i = 0; i < stmts.length; i += 100) {
		await runDbBatch(env.DB, stmts.slice(i, i + 100));
	}

	return { frontmatter: { ...frontmatter, source }, content };
}

export async function deleteAlbumFromD1(env: CloudflareEnv, slug: string) {
	await env.DB.prepare("DELETE FROM albums WHERE slug = ?").bind(slug).run();
}

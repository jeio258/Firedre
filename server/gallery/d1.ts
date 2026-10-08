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

// 单批语句数上限：D1 batch 的原子性以「一次 batch」为界，故分批不可避免；取 100 覆盖常见相册规模
const BATCH_CHUNK = 100;

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

	if (photoInserts.length + 2 <= BATCH_CHUNK) {
		// 快速路径（常见相册）：相册行 + 删旧照片 + 全部新照片能落在**同一个 batch**里，
		// 由 D1 batch 保证原子 —— 行为与修复前一致。
		const photoDelete = env.DB.prepare(
			"DELETE FROM album_photos WHERE album_slug = ?",
		).bind(slug);
		await runDbBatch(env.DB, [albumUpsert, photoDelete, ...photoInserts]);
	} else {
		// 大相册（语句数超过单批上限）：无法单批原子完成，改为「**先写新、后删旧**」。
		//
		// 原实现是「先 DELETE 全部、再分批 INSERT」：后续分片失败会留下
		// 「旧行已删、新行只写一半」的**永久残缺**（实测 20 张的相册失败后只剩 9 张）。
		// 先写后删则任一分片失败最多留下「旧+新并存」，**不丢数据**；
		// 且重复保存会收敛——上次残留的行会在本次被捕获并删除。
		const prevRows = await env.DB.prepare(
			"SELECT id FROM album_photos WHERE album_slug = ?",
		)
			.bind(slug)
			.all<{ id: number }>();
		const prevIds = (prevRows.results || []).map((r) => r.id);

		// 1) 相册行：先保证 albums 存在（album_photos 的外键才有落点）
		await runDbBatch(env.DB, [albumUpsert]);

		// 2) 分批写入新照片
		for (let i = 0; i < photoInserts.length; i += BATCH_CHUNK) {
			await runDbBatch(env.DB, photoInserts.slice(i, i + BATCH_CHUNK));
		}

		// 3) 删除旧照片行（精确按 id，绝不会误删刚写入的新行）；每语句 ≤100 个占位符
		for (let i = 0; i < prevIds.length; i += 100) {
			const chunk = prevIds.slice(i, i + 100);
			await env.DB.prepare(
				`DELETE FROM album_photos WHERE id IN (${chunk.map(() => "?").join(",")})`,
			)
				.bind(...chunk)
				.run();
		}
	}

	return { frontmatter: { ...frontmatter, source }, content };
}

export async function deleteAlbumFromD1(env: CloudflareEnv, slug: string) {
	await env.DB.prepare("DELETE FROM albums WHERE slug = ?").bind(slug).run();
}

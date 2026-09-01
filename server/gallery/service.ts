import YAML from "yaml";
import type {
	AlbumDetailFrontmatter,
	AlbumPhoto,
	AlbumSummary,
} from "../../types/album";
import type { CloudflareEnv } from "../../types/env";
import type { GalleryAlbumDetail, GalleryHubDetail } from "../../types/gallery";
import { constantTimeEqual } from "../utils/timingSafe";
import { UserError } from "../utils/userError";
import {
	GALLERY_HUB_R2_KEY,
	galleryAlbumR2Key,
	isValidGallerySlug,
} from "./constants";
import {
	normalizeAlbumSlugs,
	parseAlbumSource,
	parseHubSource,
	serializeAlbumMarkdown,
	serializeHubMarkdown,
	splitGalleryMarkdown,
	toAlbumSummary,
} from "./frontmatter";
import {
	deleteAlbumPassword,
	getAlbumPassword,
	setAlbumPassword,
} from "./password";
import { getAlbumWebDavConfig } from "./webdavConfig";
import {
	deleteAlbumFromD1,
	getAlbumFromD1,
	upsertAlbumToD1,
} from "./d1";

async function loadAlbumSummary(
	env: CloudflareEnv,
	slug: string,
): Promise<AlbumSummary | null> {

	const d1 = await getAlbumFromD1(env, slug);
	let frontmatter: AlbumDetailFrontmatter | undefined;
	if (d1) {
		frontmatter = d1.frontmatter;
	} else {
		const object = await env.BUCKET.get(galleryAlbumR2Key(slug));
		if (!object) return null;
		const source = await object.text();
		frontmatter = parseAlbumSource(source).frontmatter;
	}

	const summary = toAlbumSummary(slug, frontmatter);

	const hasPassword = (await getAlbumPassword(env, slug)) !== "";
	if (hasPassword) {
		summary.encrypted = true;
		summary.cover = undefined;
		summary.count = undefined;
	}
	return summary;
}

export async function getGalleryHub(
	env: CloudflareEnv,
	options: { includeSource?: boolean } = {},
): Promise<GalleryHubDetail | null> {
	const object = await env.BUCKET.get(GALLERY_HUB_R2_KEY);
	if (!object) return null;

	const source = await object.text();
	const parsed = parseHubSource(source);
	const slugs = normalizeAlbumSlugs(parsed.frontmatter.albums);
	const summaries: AlbumSummary[] = [];

	for (const slug of slugs) {
		const summary = await loadAlbumSummary(env, slug);
		if (summary) summaries.push(summary);
	}

	return {
		frontmatter: parsed.frontmatter,
		albums: summaries,
		source: options.includeSource ? source : undefined,
	};
}

export async function getGalleryAlbum(
	env: CloudflareEnv,
	slug: string,
	options: { includeSource?: boolean } = {},
): Promise<GalleryAlbumDetail | null> {
	return getGalleryAlbumDetail(env, slug, options);
}

async function getGalleryAlbumDetail(
	env: CloudflareEnv,
	slug: string,
	options: { includeSource?: boolean } = {},
): Promise<GalleryAlbumDetail | null> {
	if (!isValidGallerySlug(slug)) return null;

	const d1 = await getAlbumFromD1(env, slug);
	if (d1) {
		return {
			slug,
			frontmatter: d1.frontmatter,
			source: options.includeSource
				? serializeAlbumMarkdown(d1.frontmatter, d1.content)
				: undefined,
		};
	}

	const object = await env.BUCKET.get(galleryAlbumR2Key(slug));
	if (!object) return null;

	const source = await object.text();
	const parsed = parseAlbumSource(source);

	return {
		slug,
		frontmatter: parsed.frontmatter,
		source: options.includeSource ? source : undefined,
	};
}

export async function unlockGalleryAlbum(
	env: CloudflareEnv,
	slug: string,
	password: string,
): Promise<{ ok: true; photos: AlbumPhoto[] } | { ok: false }> {
	const detail = await getGalleryAlbum(env, slug);
	if (!detail) return { ok: false };

	const expected = await getAlbumPassword(env, slug);
	if (!expected) return { ok: true, photos: detail.frontmatter.photos || [] };

	if (!constantTimeEqual(password, expected)) return { ok: false };

	return { ok: true, photos: detail.frontmatter.photos || [] };
}

export async function setAlbumEncryptedFlag(
	env: CloudflareEnv,
	slug: string,
	encrypted: boolean,
): Promise<void> {
	if (!isValidGallerySlug(slug)) return;
	const detail = await getGalleryAlbumDetail(env, slug);
	if (!detail?.source) return;

	const { frontmatter, content } = splitGalleryMarkdown(detail.source);
	if (frontmatter.encrypted === encrypted) return;

	const next = { ...frontmatter, encrypted };
	const yaml = YAML.stringify(next, {
		lineWidth: 0,
		defaultKeyType: "PLAIN",
		defaultStringType: "QUOTE_DOUBLE",
	}).trimEnd();
	const normalized = `---\n${yaml}\n---\n${content}`;
	await env.BUCKET.put(galleryAlbumR2Key(slug), normalized, {
		httpMetadata: { contentType: "text/markdown; charset=utf-8" },
	});
}

export async function setAlbumSourceFlag(
	env: CloudflareEnv,
	slug: string,
	source: "local" | "webdav",
): Promise<void> {
	if (!isValidGallerySlug(slug)) return;
	const detail = await getGalleryAlbumDetail(env, slug);
	if (!detail?.source) return;

	const { frontmatter, content } = splitGalleryMarkdown(detail.source);
	if (frontmatter.source === source) return;

	const next = { ...frontmatter, source };
	const yaml = YAML.stringify(next, {
		lineWidth: 0,
		defaultKeyType: "PLAIN",
		defaultStringType: "QUOTE_DOUBLE",
	}).trimEnd();
	const normalized = `---\n${yaml}\n---\n${content}`;
	await env.BUCKET.put(galleryAlbumR2Key(slug), normalized, {
		httpMetadata: { contentType: "text/markdown; charset=utf-8" },
	});
}

export async function upsertGalleryHub(env: CloudflareEnv, source: string) {
	const parsed = parseHubSource(source);
	const normalized = serializeHubMarkdown(parsed.frontmatter, parsed.content);

	await env.BUCKET.put(GALLERY_HUB_R2_KEY, normalized, {
		httpMetadata: { contentType: "text/markdown; charset=utf-8" },
	});

	const slugs = normalizeAlbumSlugs(parsed.frontmatter.albums);
	const albums: AlbumSummary[] = [];
	for (const slug of slugs) {
		const summary = await loadAlbumSummary(env, slug);
		if (summary) albums.push(summary);
	}

	return {
		r2Key: GALLERY_HUB_R2_KEY,
		frontmatter: parsed.frontmatter,
		albums,
	};
}

async function ensureAlbumInHub(env: CloudflareEnv, slug: string) {
	const hub = await getGalleryHub(env, { includeSource: true });
	if (!hub?.source) return;
	const parsed = parseHubSource(hub.source);
	const slugs = normalizeAlbumSlugs(parsed.frontmatter.albums);
	if (slugs.includes(slug)) return; // 已在列表，不重复、不改顺序
	slugs.push(slug);
	parsed.frontmatter.albums = slugs;
	await upsertGalleryHub(
		env,
		serializeHubMarkdown(parsed.frontmatter, parsed.content),
	);
}

export async function updateGalleryAlbumOrder(
	env: CloudflareEnv,
	slugs: string[],
) {
	const clean = slugs.filter(isValidGallerySlug);
	const seen = new Set<string>();
	const unique: string[] = [];
	for (const s of clean) {
		if (seen.has(s)) continue;
		seen.add(s);
		// 仅保留真实存在的相册
		const detail = await getGalleryAlbum(env, s);
		if (detail) unique.push(s);
	}

	const hub = await getGalleryHub(env, { includeSource: true });
	if (!hub?.source) {
		throw new UserError("相册数据不存在");
	}
	const parsed = parseHubSource(hub.source);
	parsed.frontmatter.albums = unique;
	const result = await upsertGalleryHub(
		env,
		serializeHubMarkdown(parsed.frontmatter, parsed.content),
	);
	return result;
}

export async function upsertGalleryAlbum(
	env: CloudflareEnv,
	slug: string,
	source: string,
) {
	if (!isValidGallerySlug(slug)) throw new UserError("相册 slug 格式无效");

	const parsed = parseAlbumSource(source);

	const rawFm = splitGalleryMarkdown(source).frontmatter as Record<
		string,
		unknown
	>;
	const rawPassword =
		typeof rawFm.password === "string" && rawFm.password.trim()
			? rawFm.password.trim()
			: "";
	if (rawPassword) {
		await setAlbumPassword(env, slug, rawPassword);
		parsed.frontmatter.encrypted = true;
	}
	const normalized = serializeAlbumMarkdown(parsed.frontmatter, parsed.content);

	await upsertAlbumToD1(env, slug, parsed.frontmatter, parsed.content);

	await env.BUCKET.put(galleryAlbumR2Key(slug), normalized, {
		httpMetadata: { contentType: "text/markdown; charset=utf-8" },
	});
	// 创建相册：确保该相册进入前端/后台列表（自动追加到末尾）
	await ensureAlbumInHub(env, slug);

	return {
		r2Key: galleryAlbumR2Key(slug),
		slug,
		frontmatter: parsed.frontmatter,
	};
}

export async function deleteGalleryAlbum(env: CloudflareEnv, slug: string) {
	if (!isValidGallerySlug(slug)) throw new UserError("相册 slug 格式无效");

	await deleteAlbumFromD1(env, slug);
	await env.BUCKET.delete(galleryAlbumR2Key(slug));
	await deleteAlbumPassword(env, slug);

	const hub = await getGalleryHub(env, { includeSource: true });
	if (!hub?.source) return { slug, removedFromHub: false };

	const parsed = parseHubSource(hub.source);
	const nextSlugs = normalizeAlbumSlugs(parsed.frontmatter.albums).filter(
		(item) => item !== slug,
	);
	parsed.frontmatter.albums = nextSlugs;
	await upsertGalleryHub(
		env,
		serializeHubMarkdown(parsed.frontmatter, parsed.content),
	);

	return { slug, removedFromHub: true };
}

export async function setAlbumPhotos(
	env: CloudflareEnv,
	slug: string,
	photos: AlbumPhoto[],
): Promise<void> {
	if (!isValidGallerySlug(slug)) throw new UserError("相册 slug 格式无效");
	const detail = await getGalleryAlbum(env, slug, { includeSource: true });
	if (!detail) throw new UserError("相册不存在");

	const nextFrontmatter: AlbumDetailFrontmatter = {
		...detail.frontmatter,
		photos: photos.map((p) => ({
			url: p.url,
			...(p.type ? { type: p.type } : {}),
			...(p.poster ? { poster: p.poster } : {}),
			...(p.date ? { date: p.date } : {}),
		})),
	};

	// D1 相册：直接写 D1。
	const d1 = await getAlbumFromD1(env, slug);
	if (d1) {
		await upsertAlbumToD1(env, slug, nextFrontmatter, d1.content);
		return;
	}

	// 存量 R2 相册：仍走 R2 index.md 更新（保留其他字段）。
	if (!detail.source) throw new UserError("相册不存在");
	const { frontmatter, content } = splitGalleryMarkdown(detail.source);
	frontmatter.photos = photos.map((p) => ({
		url: p.url,
		...(p.type ? { type: p.type } : {}),
		...(p.poster ? { poster: p.poster } : {}),
		...(p.date ? { date: p.date } : {}),
	}));
	const normalized = serializeAlbumMarkdown(
		frontmatter as AlbumDetailFrontmatter & { layout?: string },
		content,
	);
	await env.BUCKET.put(galleryAlbumR2Key(slug), normalized, {
		httpMetadata: { contentType: "text/markdown; charset=utf-8" },
	});
}

export async function getAlbumWebDavConfigFromR2(
	env: CloudflareEnv,
	slug: string,
) {
	const album = await getGalleryAlbum(env, slug);
	if (!album || album.frontmatter.source !== "webdav") return null;

	const d1 = await getAlbumWebDavConfig(env, slug);
	const url = d1?.url || album.frontmatter.webdav?.url;
	if (!url) return null;

	return {
		url,
		...(d1?.username || album.frontmatter.webdav?.username
			? {
					username: d1?.username || album.frontmatter.webdav?.username,
				}
			: {}),
		encrypted: album.frontmatter.encrypted === true,
		albumPassword: (await getAlbumPassword(env, slug)) || undefined,
	};
}

export type { AlbumDetailFrontmatter };

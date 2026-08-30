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
	toAlbumSummary,
} from "./frontmatter";

async function loadAlbumSummary(
	env: CloudflareEnv,
	slug: string,
): Promise<AlbumSummary | null> {
	const object = await env.BUCKET.get(galleryAlbumR2Key(slug));
	if (!object) return null;

	const source = await object.text();
	const parsed = parseAlbumSource(source);
	return toAlbumSummary(slug, parsed.frontmatter);
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
	if (!isValidGallerySlug(slug)) return null;

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

	if (!detail.frontmatter.encrypted)
		return { ok: true, photos: detail.frontmatter.photos || [] };

	const expected = String(detail.frontmatter.password || "").trim();
	if (!expected || !constantTimeEqual(password, expected)) return { ok: false };

	return { ok: true, photos: detail.frontmatter.photos || [] };
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

export async function upsertGalleryAlbum(
	env: CloudflareEnv,
	slug: string,
	source: string,
) {
	if (!isValidGallerySlug(slug)) throw new UserError("相册 slug 格式无效");

	const parsed = parseAlbumSource(source);
	const normalized = serializeAlbumMarkdown(parsed.frontmatter, parsed.content);

	await env.BUCKET.put(galleryAlbumR2Key(slug), normalized, {
		httpMetadata: { contentType: "text/markdown; charset=utf-8" },
	});

	return {
		r2Key: galleryAlbumR2Key(slug),
		slug,
		frontmatter: parsed.frontmatter,
	};
}

export async function deleteGalleryAlbum(env: CloudflareEnv, slug: string) {
	if (!isValidGallerySlug(slug)) throw new UserError("相册 slug 格式无效");

	await env.BUCKET.delete(galleryAlbumR2Key(slug));

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

export async function getAlbumWebDavConfigFromR2(
	env: CloudflareEnv,
	slug: string,
) {
	const album = await getGalleryAlbum(env, slug);
	if (
		!album ||
		album.frontmatter.source !== "webdav" ||
		!album.frontmatter.webdav?.url
	)
		return null;
	return {
		...album.frontmatter.webdav,
		encrypted: album.frontmatter.encrypted === true,
		albumPassword: album.frontmatter.password
			? String(album.frontmatter.password)
			: undefined,
	};
}

export type { AlbumDetailFrontmatter };

import type {
	AlbumDetailFrontmatter,
	AlbumPhoto,
	AlbumSummary,
} from "../../types/album";
import type { CloudflareEnv } from "../../types/env";
import type { GalleryAlbumDetail, GalleryHubDetail } from "../../types/gallery";
import { constantTimeEqual } from "../utils/timingSafe";
import { UserError } from "../utils/userError";
import { deleteAlbumPassword, getAlbumPassword, setAlbumPassword } from "./password";
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

	// 密码存 D1（动态博客方式），frontmatter 不含密码
	const expected = await getAlbumPassword(env, slug);
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
	// 从原始 frontmatter 提取访问密码：存 D1（动态博客方式），不写进 R2 文件。
	// 后台编辑 markdown 里写 password 即更新相册密码；留空且未设 encrypted 则清除。
	const rawFm = splitGalleryMarkdown(source).frontmatter as Record<string, unknown>;
	const rawPassword =
		typeof rawFm.password === "string" && rawFm.password.trim()
			? rawFm.password.trim()
			: "";
	await setAlbumPassword(env, slug, rawPassword);

	// 有密码时强制带锁标记（无密码则保持用户显式 encrypted 标记）
	if (rawPassword) parsed.frontmatter.encrypted = true;
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
		albumPassword: (await getAlbumPassword(env, slug)) || undefined,
	};
}

export type { AlbumDetailFrontmatter };

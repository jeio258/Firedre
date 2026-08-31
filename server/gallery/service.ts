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

async function loadAlbumSummary(
	env: CloudflareEnv,
	slug: string,
): Promise<AlbumSummary | null> {
	const object = await env.BUCKET.get(galleryAlbumR2Key(slug));
	if (!object) return null;

	const source = await object.text();
	const parsed = parseAlbumSource(source);
	const summary = toAlbumSummary(slug, parsed.frontmatter);

	// 加密判定以 D1 密码为准（与详情页 [album].astro / gallery-files / unlockGalleryAlbum
	// 完全一致），不能信任 R2 frontmatter.encrypted：密码写 D1、encrypted 标记写 R2，二者
	// 可能不同步（firefly-2026 就出现 R2=false 但 D1 有密码），旧逻辑→列表按 R2 未加密
	// 显示封面→封面文件被 gallery-files 上锁 401→破图。
	// 一旦 D1 有密码即视为加密：隐藏封面与数量（封面同样被上锁，公开渲染只会破图），
	// 卡片自动回退到占位图；数量不对外泄露（与 toAlbumSummary 对加密的处理一致）。
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

	// 锁门判定以 D1 密码是否存在为准（与页面 [album].astro 用 D1 密码判断一致），
	// 避免 frontmatter.encrypted 与 D1 密码不同步时产生“看似加密实则公开”的漏洞。
	const expected = await getAlbumPassword(env, slug);
	if (!expected) return { ok: true, photos: detail.frontmatter.photos || [] };

	if (!constantTimeEqual(password, expected)) return { ok: false };

	return { ok: true, photos: detail.frontmatter.photos || [] };
}

/**
 * 同步 R2 frontmatter 的 encrypted 标记，使「是否上锁」与 D1 密码存在与否收敛一致。
 * 设置/清除相册密码（密码框路径）时调用：有密码 → encrypted=true，无密码 → false。
 */
export async function setAlbumEncryptedFlag(
	env: CloudflareEnv,
	slug: string,
	encrypted: boolean,
): Promise<void> {
	if (!isValidGallerySlug(slug)) return;
	const detail = await getGalleryAlbumDetail(env, slug);
	if (!detail?.source) return;

	// 用原始 frontmatter 做最小化定向改写，只改 encrypted 一行：
	// 不经过 parseAlbumSource/serializeAlbumMarkdown（其 buildAlbumPayload 白名单
	// 会丢弃 type≠image/video 的 photos、字符串 photo 条目及相册级自定义字段），
	// 避免切换密码时静默破坏相册数据。
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

/**
 * 切换相册源的 frontmatter 标记（source: local / webdav）。
 * 仅做最小化定向改写：不经过 parseAlbumSource/serializeAlbumMarkdown，避免白名单丢弃字段。
 */
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

/**
 * 确保相册 slug 出现在 hub（gallery/index.md）的 albums 列表中。
 * 创建相册时调用：相册文件写进 R2 后，若 slug 不在列表则追加到末尾，
 * 使新相册能立即出现在前端 /gallery/ 与后台管理列表。已存在则保持原顺序不动。
 */
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

/**
 * 用新的 slug 顺序覆盖 hub albums 数组（方案A：后台拖拽排序）。
 * 仅保留在 R2 中真实存在的相册，避免拖入不存在的 slug；
 * 顺序完全由调用方给定的 slugs 决定。
 */
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
	// 相册密码的唯一权威入口是后台密码框（PUT/DELETE /api/gallery/{slug}/password/，
	// 写 D1 并同步 R2 frontmatter.encrypted）。通用 markdown 编辑不应触碰 D1 密码：
	// 密码明文从不写进 R2 frontmatter（buildAlbumPayload 会剥掉 password 字段），
	// 因此这里收到的 source 通常不含 password；若无条件以空值调用 setAlbumPassword
	// 会把 D1 密码一并 DELETE，导致管理员用密码框设的密码被一次普通编辑清除。
	// 仅当 frontmatter 显式含非空 password 时（旧手写 password 相册的向后兼容），
	// 才同步到 D1 并强制带锁标记；否则保持 D1 现状不动。
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

/**
 * 用图床拉取的直链列表覆盖相册 frontmatter.photos（方案①）。
 * 相册 source 保持 local（公开直链本质相同），仅替换 photos 字段，不触碰其他字段。
 */
export async function setAlbumPhotos(
	env: CloudflareEnv,
	slug: string,
	photos: AlbumPhoto[],
): Promise<void> {
	if (!isValidGallerySlug(slug)) throw new UserError("相册 slug 格式无效");
	const detail = await getGalleryAlbum(env, slug, { includeSource: true });
	if (!detail?.source) throw new UserError("相册不存在");

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

	// url/username 权威存 D1 album_webdav（方案②）；旧手写相册的 frontmatter webdav 块作向后兼容回退。
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

import YAML from "yaml";
import type {
	AlbumDetailFrontmatter,
	AlbumPhoto,
	AlbumSource,
	AlbumSummary,
	AlbumWebDavFrontmatterConfig,
	GalleryHubFrontmatter,
} from "../../types/album";

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

function normalizePhoto(raw: Record<string, unknown>): AlbumPhoto {
	const type =
		raw.type === "video" || raw.type === "image" ? raw.type : undefined;
	return {
		url: String(raw.url || ""),
		date: raw.date ? String(raw.date) : undefined,
		type,
		poster: raw.poster ? String(raw.poster) : undefined,
	};
}

export function splitGalleryMarkdown(source: string) {
	const match = source.match(FRONTMATTER_RE);
	if (!match) {
		return {
			frontmatter: {} as Record<string, unknown>,
			content: source,
		};
	}

	const parsed = YAML.parse(match[1]);
	return {
		frontmatter: (parsed && typeof parsed === "object" ? parsed : {}) as Record<
			string,
			unknown
		>,
		content: match[2],
	};
}

export function normalizeAlbumSlugs(value: unknown): string[] {
	if (!Array.isArray(value)) return [];

	return value
		.map((item) => {
			if (typeof item === "string") return item.trim();
			if (item && typeof item === "object" && "slug" in item)
				return String((item as { slug?: string }).slug || "").trim();
			return "";
		})
		.filter(Boolean);
}

export function normalizeAlbumFrontmatter(
	raw: Record<string, unknown>,
): AlbumDetailFrontmatter & { layout?: string } {
	const source = raw.source === "webdav" ? "webdav" : "local";
	const photosRaw = Array.isArray(raw.photos) ? raw.photos : [];
	const photos =
		source === "local"
			? photosRaw
					.filter((item) => item && typeof item === "object")
					.map((item) => normalizePhoto(item as Record<string, unknown>))
					.filter((photo) => photo.url)
			: undefined;

	let webdav: AlbumWebDavFrontmatterConfig | undefined;
	if (source === "webdav" && raw.webdav && typeof raw.webdav === "object") {
		const block = raw.webdav as Record<string, unknown>;
		const url = String(block.url || "").trim();
		if (url) {
			webdav = {
				url,
				username: block.username ? String(block.username) : undefined,
			};
		}
	}

	return {
		layout: "gallery-album",
		title: raw.title ? String(raw.title) : undefined,
		cover: raw.cover ? String(raw.cover) : undefined,
		desc: raw.desc ? String(raw.desc) : undefined,
		date: raw.date ? String(raw.date) : undefined,
		location: raw.location ? String(raw.location) : undefined,
		tags: Array.isArray(raw.tags) ? raw.tags.map(String) : undefined,
		comment: raw.comment === true ? true : undefined,
		encrypted: raw.encrypted === true,
		source,
		webdav,
		photos,
	};
}

export function normalizeHubFrontmatter(
	raw: Record<string, unknown>,
): GalleryHubFrontmatter & {
	title?: string;
	icon?: string;
	layout?: string;
	comment?: boolean;
} {
	return {
		layout: "gallery",
		title: raw.title ? String(raw.title) : "相册",
		icon: raw.icon ? String(raw.icon) : "i-ri-gallery-line",
		cover: raw.cover ? String(raw.cover) : undefined,
		comment: raw.comment === true ? true : undefined,
		albums: normalizeAlbumSlugs(raw.albums),
	};
}

export function toAlbumSummary(
	slug: string,
	frontmatter: AlbumDetailFrontmatter,
): AlbumSummary {
	const photos = Array.isArray(frontmatter.photos) ? frontmatter.photos : [];
	const isWebDav = frontmatter.source === "webdav";

	return {
		slug,
		title: frontmatter.title || slug,
		date: frontmatter.date || "",
		cover: frontmatter.cover,
		desc: frontmatter.desc,
		// 加密相册不对外泄露照片数量（避免信息泄漏），count 置 undefined
		count:
			isWebDav || frontmatter.encrypted
				? undefined
				: photos.length || undefined,
		location: frontmatter.location,
		tags: Array.isArray(frontmatter.tags) ? frontmatter.tags : undefined,
		encrypted: !!frontmatter.encrypted,
		source: frontmatter.source as AlbumSource | undefined,
	};
}

function buildAlbumPayload(
	frontmatter: AlbumDetailFrontmatter & { layout?: string },
) {
	const payload: Record<string, unknown> = {
		layout: "gallery-album",
		title: frontmatter.title || "",
		source: frontmatter.source || "local",
	};

	if (frontmatter.date?.trim()) payload.date = frontmatter.date.trim();
	if (frontmatter.cover?.trim()) payload.cover = frontmatter.cover.trim();
	if (frontmatter.desc?.trim()) payload.desc = frontmatter.desc.trim();
	if (frontmatter.location?.trim())
		payload.location = frontmatter.location.trim();
	if (Array.isArray(frontmatter.tags) && frontmatter.tags.length)
		payload.tags = frontmatter.tags.map(String);
	if (frontmatter.comment === true) payload.comment = true;

	payload.encrypted = frontmatter.encrypted === true;

	if (frontmatter.source === "webdav" && frontmatter.webdav?.url) {
		payload.webdav = {
			url: frontmatter.webdav.url.trim(),
			...(frontmatter.webdav.username?.trim()
				? { username: frontmatter.webdav.username.trim() }
				: {}),
		};
	} else if (frontmatter.source !== "webdav") {
		payload.photos = Array.isArray(frontmatter.photos)
			? frontmatter.photos.map((photo) => {
					const item: Record<string, string> = { url: photo.url.trim() };
					if (photo.date?.trim()) item.date = photo.date.trim();
					if (photo.type) item.type = photo.type;
					if (photo.poster?.trim()) item.poster = photo.poster.trim();
					return item;
				})
			: [];
	}

	return payload;
}

export function serializeHubMarkdown(
	frontmatter: GalleryHubFrontmatter & {
		title?: string;
		icon?: string;
		layout?: string;
		comment?: boolean;
	},
	content = "",
) {
	const payload: Record<string, unknown> = {
		layout: "gallery",
		title: frontmatter.title || "相册",
		icon: frontmatter.icon || "i-ri-gallery-line",
	};

	if (frontmatter.cover?.trim()) payload.cover = frontmatter.cover.trim();
	if (frontmatter.comment === true) payload.comment = true;

	const slugs = normalizeAlbumSlugs(frontmatter.albums);
	if (slugs.length) payload.albums = slugs;

	const yaml = YAML.stringify(payload, {
		lineWidth: 0,
		defaultKeyType: "PLAIN",
		defaultStringType: "QUOTE_DOUBLE",
	}).trimEnd();

	return `---\n${yaml}\n---\n${content}`;
}

export function serializeAlbumMarkdown(
	frontmatter: AlbumDetailFrontmatter & { layout?: string },
	content = "",
) {
	const payload = buildAlbumPayload(frontmatter);
	const yaml = YAML.stringify(payload, {
		lineWidth: 0,
		defaultKeyType: "PLAIN",
		defaultStringType: "QUOTE_DOUBLE",
	}).trimEnd();

	return `---\n${yaml}\n---\n${content}`;
}

export function parseHubSource(source: string) {
	const { frontmatter, content } = splitGalleryMarkdown(source);
	return {
		frontmatter: normalizeHubFrontmatter(frontmatter),
		content,
	};
}

export function parseAlbumSource(source: string) {
	const { frontmatter, content } = splitGalleryMarkdown(source);
	return {
		frontmatter: normalizeAlbumFrontmatter(frontmatter),
		content,
	};
}

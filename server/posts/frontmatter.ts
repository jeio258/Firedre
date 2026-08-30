import type { PostFrontmatter } from "../../types/posts";

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

function parseSimpleYaml(yaml: string): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	let currentKey: string | null = null;
	let listItems: string[] | null = null;

	function flushList() {
		if (currentKey && listItems) result[currentKey] = listItems;
		listItems = null;
	}

	for (const rawLine of yaml.split(/\r?\n/)) {
		const line = rawLine.trimEnd();
		if (!line.trim() || line.trim().startsWith("#")) continue;

		const listMatch = line.match(/^\s*-\s+(.+)$/);
		if (listMatch && listItems) {
			listItems.push(unquote(listMatch[1].trim()));
			continue;
		}

		flushList();

		const kvMatch = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
		if (!kvMatch) continue;

		const key = kvMatch[1];
		const value = kvMatch[2].trim();
		currentKey = key;

		if (!value) {
			listItems = [];
			continue;
		}

		result[key] = parseScalar(value);
	}

	flushList();
	return result;
}

function unquote(value: string) {
	if (
		(value.startsWith('"') && value.endsWith('"')) ||
		(value.startsWith("'") && value.endsWith("'"))
	) {
		return value.slice(1, -1);
	}
	return value;
}

type YamlScalar = string | number | boolean | YamlScalar[];

function parseScalar(value: string): YamlScalar {
	const unquoted = unquote(value);
	if (unquoted === "true") return true;
	if (unquoted === "false") return false;
	if (/^-?\d+$/.test(unquoted)) return Number(unquoted);
	// YAML 内联数组：tags: [a, b, "c"]
	if (unquoted.startsWith("[") && unquoted.endsWith("]")) {
		const inner = unquoted.slice(1, -1).trim();
		if (!inner) return [];
		const items: YamlScalar[] = inner
			.split(",")
			.map((item) => parseScalar(item.trim()))
			.filter((item) => item !== "");
		return items;
	}
	return unquoted;
}

export function splitMarkdown(source: string) {
	const match = source.match(FRONTMATTER_RE);
	if (!match) return { frontmatter: {} as PostFrontmatter, content: source };

	const parsed = parseSimpleYaml(match[1]);
	return {
		frontmatter: parsed as PostFrontmatter,
		content: match[2],
	};
}

export function postR2Key(slug: string) {
	return `posts/${slug}.md`;
}

/** slug 可为多段路径（如 guide/firefly-layout-system），逐段编码 */
export function encodePostPath(slug: string) {
	const segments = slug
		.split("/")
		.filter(Boolean)
		.map((segment) => encodeURIComponent(segment));
	return `/posts/${segments.join("/")}`;
}

export function decodePostSlug(pathSegment: string) {
	try {
		return pathSegment
			.split("/")
			.map((segment) => decodeURIComponent(segment))
			.join("/");
	} catch {
		return pathSegment;
	}
}

/**
 * 合法文章 slug：允许 '/'（子目录文章），禁止 '..'、路径穿越与前后空白。
 */
export function isValidPostSlug(slug: string) {
	if (!slug || slug.trim() !== slug) return false;
	if (slug.includes("..") || slug.includes("\\")) return false;
	if (slug.startsWith("/") || slug.endsWith("/") || slug.includes("//"))
		return false;
	return slug.split("/").every((segment) => /^[a-zA-Z0-9._-]+$/.test(segment));
}

export function normalizeTags(
	tags: PostFrontmatter["tags"],
): string[] | undefined {
	if (!tags) return undefined;
	if (Array.isArray(tags)) return tags.map(String).filter(Boolean);
	return [String(tags)].filter(Boolean);
}

export function normalizeCategories(categories: PostFrontmatter["categories"]) {
	if (!categories) return undefined;
	if (Array.isArray(categories)) return categories.map(String).filter(Boolean);
	return [String(categories)].filter(Boolean);
}

/**
 * 统一的分类解析：优先复数 categories（含空数组），否则回退单数 category。
 * upsertPost 写 categories 列与 syncPostTaxonomy 写 post_categories 都必须走这里，
 * 保证两套存储永远一致（避免分类漂移）。
 */
export function resolveCategories(
	frontmatter: PostFrontmatter,
): string[] | undefined {
	const normalized = normalizeCategories(frontmatter.categories);
	if (normalized && normalized.length > 0) return normalized;
	if (frontmatter.category) {
		const single = String(frontmatter.category).trim();
		return single ? [single] : undefined;
	}
	return undefined;
}

export function categoryPathFromFrontmatter(
	categories: PostFrontmatter["categories"],
): string {
	if (!categories) return "Uncategorized";
	if (typeof categories === "string")
		return categories.trim() || "Uncategorized";
	const parts = categories.map(String).filter(Boolean);
	return parts.length ? parts.join("/") : "Uncategorized";
}

/** Firefly 风格：draft/hidden 视为未发布 */
export function isPublished(fm: PostFrontmatter) {
	if (fm.draft === true || fm.hidden === true) return false;
	return true;
}

export function serializeFrontmatter(fm: PostFrontmatter, content: string) {
	const lines = ["---"];
	for (const [key, value] of Object.entries(fm)) {
		if (value === undefined || value === null) continue;
		if (Array.isArray(value)) {
			lines.push(`${key}:`);
			for (const item of value) lines.push(`  - ${item}`);
			continue;
		}
		if (typeof value === "string" && /[:#]/.test(value))
			lines.push(`${key}: "${value.replace(/"/g, '\\"')}"`);
		else lines.push(`${key}: ${value}`);
	}
	lines.push("---", "");
	return `${lines.join("\n")}${content}`;
}

/**
 * 将 Firefly 风格 frontmatter 映射为 D1 记录字段。
 */
export function mapFrontmatterToRecord(frontmatter: PostFrontmatter) {
	const categories =
		normalizeCategories(frontmatter.categories) ??
		(frontmatter.category ? [String(frontmatter.category)] : []);
	const tags = normalizeTags(frontmatter.tags) ?? [];
	const date = String(frontmatter.published || frontmatter.date || "");
	const cover = frontmatter.image || frontmatter.cover || "";
	const description = frontmatter.description || frontmatter.excerpt || "";
	const excerpt =
		frontmatter.excerpt ||
		frontmatter.description ||
		firstTextLine(frontmatter) ||
		"";
	const password = String(frontmatter.password || "");
	const pinOrder = normalizePinOrderValue(
		frontmatter.pin_order ?? (frontmatter.pinned ? 1 : frontmatter.top),
	);
	const published = isPublished(frontmatter) ? 1 : 0;

	return {
		title: String(frontmatter.title || ""),
		date,
		updated: frontmatter.updated ? String(frontmatter.updated) : undefined,
		description,
		excerpt,
		categories,
		tags,
		cover,
		password,
		pinOrder,
		published,
	};
}

function firstTextLine(frontmatter: PostFrontmatter) {
	return "";
}

function normalizePinOrderValue(value: unknown): number {
	if (value === undefined || value === null || value === "" || value === false)
		return 0;
	if (value === true) return 1;
	const n = Number(value);
	if (!Number.isFinite(n) || n <= 0) return 0;
	return Math.floor(n);
}

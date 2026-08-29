import YAML from "yaml";
import type {
	FriendLinkGroup,
	FriendLinkItem,
	LinksFrontmatter,
} from "../../types/links";

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

function normalizeLinkItem(raw: Record<string, unknown>): FriendLinkItem {
	return {
		url: String(raw.url || raw.link || ""),
		avatar: String(raw.avatar || ""),
		name: String(raw.name || ""),
		blog: raw.blog ? String(raw.blog) : undefined,
		desc: raw.desc
			? String(raw.desc)
			: raw.descr
				? String(raw.descr)
				: undefined,
		color: raw.color ? String(raw.color) : undefined,
		siteshot: raw.siteshot ? String(raw.siteshot) : undefined,
	};
}

function normalizeLinkGroup(raw: Record<string, unknown>): FriendLinkGroup {
	const linksRaw = Array.isArray(raw.links) ? raw.links : [];
	return {
		name: raw.name ? String(raw.name) : "",
		desc: raw.desc ? String(raw.desc) : "",
		links: linksRaw
			.filter((item) => item && typeof item === "object")
			.map((item) => normalizeLinkItem(item as Record<string, unknown>))
			.filter((link) => link.url && link.avatar && link.name),
	};
}

export function extractLinkGroups(
	frontmatter: LinksFrontmatter,
): FriendLinkGroup[] {
	if (
		Array.isArray(frontmatter.linkGroups) &&
		frontmatter.linkGroups.length > 0
	)
		return frontmatter.linkGroups;

	if (Array.isArray(frontmatter.links) && frontmatter.links.length > 0) {
		return [
			{
				name: "",
				desc: "",
				links: frontmatter.links,
			},
		];
	}

	return [];
}

export function splitLinksMarkdown(source: string) {
	const match = source.match(FRONTMATTER_RE);
	if (!match) {
		return {
			frontmatter: {} as LinksFrontmatter,
			content: source,
		};
	}

	const parsed = YAML.parse(match[1]) as LinksFrontmatter | null;
	const frontmatter = (
		parsed && typeof parsed === "object" ? parsed : {}
	) as LinksFrontmatter;

	if (Array.isArray(frontmatter.linkGroups)) {
		frontmatter.linkGroups = frontmatter.linkGroups.map((group) =>
			normalizeLinkGroup(group as unknown as Record<string, unknown>),
		);
	}

	if (Array.isArray(frontmatter.links)) {
		frontmatter.links = frontmatter.links.map((link) =>
			normalizeLinkItem(link as unknown as Record<string, unknown>),
		);
	}

	return {
		frontmatter,
		content: match[2],
	};
}

function serializeScalar(value: string | boolean | number) {
	if (typeof value === "boolean") return String(value);
	if (typeof value === "number") return String(value);
	if (/[:#"'\n]/.test(value))
		return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
	return value;
}

function serializeLinkItem(link: FriendLinkItem) {
	const item: Record<string, string> = {
		url: link.url.trim(),
		avatar: link.avatar.trim(),
		name: link.name.trim(),
	};

	const blog = (link.blog || "").trim();
	if (blog && blog !== item.name) item.blog = blog;

	const desc = (link.desc || link.descr || "").trim();
	if (desc) item.desc = desc;

	const color = (link.color || "").trim();
	if (color) item.color = color;

	const siteshot = (link.siteshot || "").trim();
	if (siteshot) item.siteshot = siteshot;

	return item;
}

export function serializeLinksFrontmatter(
	frontmatter: LinksFrontmatter,
	content = "",
) {
	const payload: Record<string, unknown> = {
		layout: "links",
		title: frontmatter.title || "友链",
		icon: frontmatter.icon || "i-ri-links-line",
	};

	if (frontmatter.cover?.trim()) payload.cover = frontmatter.cover.trim();

	if (frontmatter.comment === true) payload.comment = true;

	if (frontmatter.random === true) payload.random = true;

	if (frontmatter.errorImg?.trim())
		payload.errorImg = frontmatter.errorImg.trim();

	const groups = extractLinkGroups(frontmatter);
	payload.linkGroups = groups.map((group) => {
		const entry: Record<string, unknown> = {};
		if (group.name?.trim()) entry.name = group.name.trim();
		if (group.desc?.trim()) entry.desc = group.desc.trim();
		entry.links = (group.links || []).map(serializeLinkItem);
		return entry;
	});

	const yaml = YAML.stringify(payload, {
		lineWidth: 0,
		defaultKeyType: "PLAIN",
		defaultStringType: "QUOTE_DOUBLE",
	}).trimEnd();

	return `---\n${yaml}\n---\n${content}`;
}

export function parseLinksSource(source: string) {
	const { frontmatter, content } = splitLinksMarkdown(source);
	return {
		frontmatter,
		content,
		linkGroups: extractLinkGroups(frontmatter),
	};
}

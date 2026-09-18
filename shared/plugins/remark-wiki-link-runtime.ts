

import { slug } from "github-slugger";
import { getApiUrlList, processCoverImageSync } from "../utils/image-utils";

export interface WikiLinkPostMeta {
	slug: string;
	title: string;
	description?: string;
	published?: string;
	category?: string;
	tags?: string[];
	password?: string;
	image?: string;
}

export type WikiLinkResolver = (
	contentPath: string,
) => Promise<WikiLinkPostMeta | null>;

export interface RemarkWikiLinkRuntimeOptions {
	resolve: WikiLinkResolver;
}

const MARKDOWN_EXTENSION = /\.(?:md|mdx|markdown)$/i;
const WIKI_LINK = /!?\[\[([^[\]\n]+)\]\]/g;
const STANDALONE_WIKI_LINK = /^\[\[([^[\]\n]+)\]\]$/;
const SKIPPED_NODE_TYPES = new Set([
	"link",
	"linkReference",
	"mdxJsxFlowElement",
	"mdxJsxTextElement",
]);

function normalizeContentPath(value: string) {
	const contentPath = value
		.trim()
		.replaceAll("\\", "/")
		.replace(/^\.?\//, "")
		.replace(/\/+$/, "")
		.replace(MARKDOWN_EXTENSION, "");
	const segments = contentPath.split("/").filter(Boolean);

	if (
		segments.length === 0 ||
		segments.some((segment) => segment === "." || segment === "..")
	) {
		return "";
	}

	const withoutPrefix = segments[0] === "posts" ? segments.slice(1) : segments;
	return withoutPrefix.length > 0 ? withoutPrefix.join("/") : "";
}

function createPostUrl(contentPath: string) {
	const segments = contentPath.split("/");
	if (segments.at(-1)?.toLowerCase() === "index") segments.pop();
	const encodedPath = segments
		.map((segment) => encodeURIComponent(segment))
		.join("/");
	return `/posts/${encodedPath ? `${encodedPath}/` : ""}`;
}

function createElement(
	tagName: string,
	properties: Record<string, unknown>,
	children: unknown[],
) {
	return {
		type: "paragraph",
		data: { hName: tagName, hProperties: properties },
		children,
	};
}

function createText(value: string) {
	return { type: "text", value };
}

function parseWikiLinkValue(value: string) {
	const aliasSeparator = value.indexOf("|");
	const destination = (
		aliasSeparator === -1 ? value : value.slice(0, aliasSeparator)
	).trim();
	const alias =
		aliasSeparator === -1 ? "" : value.slice(aliasSeparator + 1).trim();

	if (!destination) return null;

	const headingSeparator = destination.indexOf("#");
	const pageName =
		headingSeparator === -1
			? destination
			: destination.slice(0, headingSeparator).trim();
	const heading =
		headingSeparator === -1
			? ""
			: destination.slice(headingSeparator + 1).trim();
	const contentPath = pageName ? normalizeContentPath(pageName) : "";

	if ((pageName && !contentPath) || (!contentPath && !heading)) return null;

	return { destination, alias, contentPath, heading };
}

function createRemoteCoverImg(
	src: string,
	extraProperties: Record<string, unknown>,
) {
	return createElement(
		"img",
		{ src, alt: "", loading: "lazy", decoding: "async", ...extraProperties },
		[],
	);
}

function createCoverNode(meta: WikiLinkPostMeta, resolvedSlug: string) {
	const image = typeof meta.image === "string" ? meta.image.trim() : "";
	if (!image) return null;

	if (image === "api") {
		const seed = resolvedSlug.replace(/\/index$/i, "");
		const firstUrl = processCoverImageSync(image, seed);
		if (!firstUrl) return null;
		const apiUrls = getApiUrlList(image, seed);
		return createElement(
			"div",
			{
				class: "cover-image-container",
				"data-api-urls":
					apiUrls.length > 0 ? JSON.stringify(apiUrls) : undefined,
			},
			[
				createRemoteCoverImg(firstUrl, {
					"data-cover-img": "true",
					"data-remote": "true",
				}),
			],
		);
	}

	if (/^(?:https?:)?\/\//i.test(image) || image.startsWith("/")) {
		return createRemoteCoverImg(image, {});
	}

	return null;
}

function isNoiseAlias(
	parsed: { destination: string; contentPath: string; alias: string },
	meta: WikiLinkPostMeta,
) {
	const noise = new Set<string>([
		parsed.destination,
		parsed.contentPath,
		parsed.contentPath.split("/").at(-1) || "",
		meta.slug,
		meta.slug.split("/").at(-1) || "",
	]);
	return noise.has(parsed.alias);
}

function createWikiLinkCard(
	parsed: { destination: string; contentPath: string; alias: string },
	meta: WikiLinkPostMeta,
) {
	const resolvedPath = meta.slug;
	const title =
		parsed.alias && !isNoiseAlias(parsed, meta)
			? parsed.alias
			: meta.title || resolvedPath;
	const encrypted =
		typeof meta.password === "string" && meta.password.length > 0;
	const description =
		typeof meta.description === "string" ? meta.description.trim() : "";
	const published = meta.published || "";
	const category = meta.category || "";
	const tags = Array.isArray(meta.tags) ? meta.tags.filter(Boolean) : [];

	const metaItems: unknown[] = [];
	if (published) {
		metaItems.push(
			createElement("span", { class: "wlc-date" }, [createText(published)]),
		);
	}
	if (category) {
		metaItems.push(
			createElement("span", { class: "wlc-category" }, [createText(category)]),
		);
	}
	if (tags.length > 0) {
		metaItems.push(
			createElement(
				"span",
				{ class: "wlc-tags" },
				tags.map((tag) =>
					createElement("span", { class: "wlc-tag" }, [createText(`#${tag}`)]),
				),
			),
		);
	}

	const info = [
		createElement(
			"div",
			{ class: `wlc-title${encrypted ? " wlc-encrypted" : ""}` },
			[createText(title)],
		),
	];
	if (description) {
		info.push(
			createElement("div", { class: "wlc-description" }, [
				createText(description),
			]),
		);
	}
	if (metaItems.length > 0) {
		info.push(createElement("div", { class: "wlc-meta" }, metaItems));
	}

	const children: unknown[] = [
		createElement("div", { class: "wlc-info" }, info),
	];

	const cover = createCoverNode(meta, resolvedPath);
	if (cover) {
		children.push(createElement("div", { class: "wlc-cover" }, [cover]));
	}

	return createElement(
		"a",
		{ class: "card-wiki-link no-styling", href: createPostUrl(resolvedPath) },
		children,
	);
}

function createWikiLink(value: string, meta: WikiLinkPostMeta | null) {
	const parsed = parseWikiLinkValue(value);
	if (!parsed) return null;

	const title = typeof meta?.title === "string" && meta.title ? meta.title : "";

	let text = "";
	if (parsed.alias && !(meta && isNoiseAlias(parsed, meta))) {
		text = parsed.alias;
	} else if (parsed.contentPath) {
		const pageText =
			title || parsed.destination.replace(MARKDOWN_EXTENSION, "");
		text = parsed.heading ? `${pageText}#${parsed.heading}` : pageText;
	} else {
		text = parsed.heading;
	}

	const pageUrl = parsed.contentPath
		? createPostUrl(meta ? meta.slug : parsed.contentPath)
		: "";
	const url = `${pageUrl}${parsed.heading ? `#${slug(parsed.heading)}` : ""}`;

	return {
		type: "link",
		url,
		children: [createText(text)],
	};
}

export function remarkWikiLinkRuntime(options: RemarkWikiLinkRuntimeOptions) {
	const { resolve } = options;

	const metaCache = new Map<string, WikiLinkPostMeta | null>();

	async function getMeta(contentPath: string) {
		if (metaCache.has(contentPath)) return metaCache.get(contentPath) ?? null;
		const meta = await resolve(contentPath);
		metaCache.set(contentPath, meta);
		return meta;
	}

	async function replaceWikiLinks(value: string) {
		const children: unknown[] = [];
		let cursor = 0;
		let changed = false;

		for (const match of value.matchAll(WIKI_LINK)) {
			if (match[0].startsWith("!")) continue;

			const parsed = parseWikiLinkValue(match[1]);
			let link: unknown = null;
			if (parsed) {
				if (parsed.contentPath) {
					const meta = await getMeta(parsed.contentPath);
					link = meta
						? createWikiLinkCard(parsed, meta)
						: createWikiLink(match[1], null);
				} else {
					link = createWikiLink(match[1], null);
				}
			}
			if (!link) continue;

			const index = match.index ?? 0;
			if (index > cursor) {
				children.push({ type: "text", value: value.slice(cursor, index) });
			}
			children.push(link);
			cursor = index + match[0].length;
			changed = true;
		}

		if (!changed) return null;
		if (cursor < value.length) {
			children.push({ type: "text", value: value.slice(cursor) });
		}
		return children;
	}

	async function tryCreateCardFromParagraph(
		node: Record<string, unknown>,
	): Promise<unknown> {
		if (
			node.type !== "paragraph" ||
			!Array.isArray(node.children) ||
			node.children.length !== 1
		) {
			return null;
		}
		const child = node.children[0] as Record<string, unknown>;
		if (child.type !== "text" || typeof child.value !== "string") return null;

		const match = child.value.trim().match(STANDALONE_WIKI_LINK);
		if (!match) return null;

		const parsed = parseWikiLinkValue(match[1]);
		if (!parsed || parsed.heading || !parsed.contentPath) return null;

		const meta = await getMeta(parsed.contentPath);
		if (!meta) return null;
		return createWikiLinkCard(parsed, meta);
	}

	async function transformNode(node: Record<string, unknown>) {
		if (
			SKIPPED_NODE_TYPES.has(String(node.type)) ||
			!Array.isArray(node.children)
		)
			return;

		const children = node.children;
		for (let index = 0; index < children.length; index++) {
			const child = children[index] as Record<string, unknown>;

			const card = (await tryCreateCardFromParagraph(child)) as Record<
				string,
				unknown
			> | null;
			if (card) {
				children[index] = card;
				continue;
			}

			if (child.type === "text" && typeof child.value === "string") {
				const replacement = await replaceWikiLinks(child.value);
				if (replacement) {
					children.splice(index, 1, ...replacement);
					index += replacement.length - 1;
					continue;
				}
				continue;
			}

			await transformNode(child);
		}
	}

	return (tree: Record<string, unknown>) => transformNode(tree);
}

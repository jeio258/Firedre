

import katex from "katex";
import { toString } from "mdast-util-to-string";
import rehypeRaw from "rehype-raw";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import remarkSmartypants from "remark-smartypants";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import "katex/dist/contrib/mhchem.mjs"; // mhchem 扩展
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeCallouts from "rehype-callouts";
import rehypeCodeGroup from "rehype-code-group";
import rehypeComponents from "rehype-components";
import rehypeKatex from "rehype-katex";
import rehypeSlug from "rehype-slug";
import remarkAdmonitionToBlockquoteCallout from "remark-admonition-to-blockquote-callout";
import remarkDirective from "remark-directive";
import remarkMath from "remark-math";
import remarkSectionize from "remark-sectionize";
import { siteConfig } from "../../src/config/index";
import { plantumlConfig } from "../../src/config/plantumlConfig";
import { GithubCardComponent } from "../../src/plugins/rehype-component-github-card.mjs";
import { rehypeDiagramPanZoom } from "../../src/plugins/rehype-diagram-panzoom.mjs";
import rehypeEmailProtection from "../../src/plugins/rehype-email-protection.mjs";
import rehypeExternalLinks from "../../src/plugins/rehype-external-links.mjs";
import rehypeFigure from "../../src/plugins/rehype-figure.mjs";
import rehypeImageReferrerPolicy from "../../src/plugins/rehype-image-referrerpolicy.mjs";
import { rehypePlantuml } from "../../src/plugins/rehype-plantuml.mjs";
import { parseDirectiveNode } from "../../src/plugins/remark-directive-rehype.js";
import { remarkImageGrid } from "../../src/plugins/remark-image-grid.js";
import { remarkMermaid } from "../../src/plugins/remark-mermaid.js";
import { remarkPlantuml } from "../../src/plugins/remark-plantuml.js";
import {
	remarkWikiLinkRuntime,
	type WikiLinkResolver,
} from "../../src/plugins/remark-wiki-link-runtime";
import { rehypeSanitizeDangerous } from "./sanitize";

export { stripMarkdown } from "./markdown";

export interface MarkdownHeading {
	depth: number;
	slug: string;
	text: string;
}

export interface RenderedMarkdown {
	html: string;
	headings: MarkdownHeading[];
	words: number;
	minutes: number;
	excerpt: string;
	frontmatter: Record<string, unknown>;
}

export interface RenderMarkdownOptions {
	frontmatter?: Record<string, unknown>;

	resolveWikiLink?: WikiLinkResolver;
}

function remarkReadingTimeLocal() {
	return (tree: unknown, file: { data?: Record<string, unknown> }) => {
		const textOnPage = toString(tree as never);
		// 与 Firefly remark-reading-time 相同的估算
		const words = countTextWords(textOnPage);
		const minutes = Math.max(1, Math.round(words / 200));
		const fm = (file.data?.frontmatter ?? {}) as Record<string, unknown>;
		fm.words = words;
		fm.minutes = minutes;
		file.data = { ...(file.data || {}), frontmatter: fm };
	};
}

function remarkExcerptLocal() {
	return (tree: unknown, file: { data?: Record<string, unknown> }) => {
		let excerpt = "";
		for (const node of (tree as { children?: unknown[] }).children ?? []) {
			if ((node as { type?: string }).type !== "paragraph") continue;
			excerpt = toString(node as never);
			break;
		}
		const fm = (file.data?.frontmatter ?? {}) as Record<string, unknown>;
		fm.excerpt = excerpt;
		file.data = { ...(file.data || {}), frontmatter: fm };
	};
}

function countTextWords(text: string): number {
	const trimmed = text.trim();
	if (!trimmed) return 0;
	const cjk =
		trimmed.match(/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g)?.length ?? 0;
	const words = trimmed.split(/\s+/).filter(Boolean).length;
	return cjk + words;
}

function rehypeCollectHeadings() {
	return (tree: unknown, file: { data?: Record<string, unknown> }) => {
		const headings: MarkdownHeading[] = [];
		visit(
			tree as never,
			(node: {
				type?: string;
				tagName?: string;
				properties?: Record<string, unknown>;
			}) => {
				if (node.type !== "element" || typeof node.tagName !== "string") return;
				const m = /^h([1-6])$/.exec(node.tagName);
				if (!m) return;
				const depth = Number.parseInt(m[1], 10);
				const text = toString(node as never);
				const slug = String(node.properties?.id || "");
				headings.push({ depth, slug, text });
			},
		);
		file.data = { ...(file.data || {}), headings };
	};
}

interface UnifiedProcessor extends ReturnType<typeof unified> {
	use(...args: unknown[]): UnifiedProcessor;
}

function buildProcessor(resolveWikiLink: WikiLinkResolver | null) {
	return (unified() as unknown as UnifiedProcessor)
		.use(remarkParse)
		.use(remarkGfm)
		.use(remarkSmartypants)
		.use(remarkAdmonitionToBlockquoteCallout)
		.use(remarkMath)
		.use(remarkReadingTimeLocal)
		.use(remarkWikiLinkRuntime, {
			resolve: (contentPath: string) =>
				resolveWikiLink
					? resolveWikiLink(contentPath)
					: Promise.resolve(null),
		})
		.use(remarkImageGrid)
		.use(remarkExcerptLocal)
		.use(remarkDirective)
		.use(remarkSectionize)
		.use(parseDirectiveNode)
		.use(remarkMermaid)
		.use(remarkPlantuml, plantumlConfig)
		.use(remarkRehype, { allowDangerousHtml: true })
		.use(rehypeRaw)
		.use(rehypeSanitizeDangerous)
		.use(rehypeKatex, { katex })
		.use(rehypeCallouts, { theme: siteConfig.post.rehypeCallouts.theme })
		.use(rehypeSlug)
		.use(rehypeCodeGroup)
		.use(rehypePlantuml)
		.use(rehypeDiagramPanZoom)
		.use(rehypeFigure)
		.use(rehypeImageReferrerPolicy, {
			domains: siteConfig.imageOptimization?.noReferrerDomains || [],
		})
		.use(rehypeExternalLinks, { siteUrl: siteConfig.site_url })
		.use(rehypeEmailProtection, { method: "base64" })
		.use(rehypeComponents, { components: { github: GithubCardComponent } })
		.use(rehypeCollectHeadings)
		.use(rehypeAutolinkHeadings, {
			behavior: "append",
			properties: { className: ["anchor"] },
			content: {
				type: "element",
				tagName: "span",
				properties: { className: ["anchor-icon"] },
				children: [{ type: "text", value: "#" }],
			},
		})
		.use(rehypeStringify, { allowDangerousHtml: true });
}

export async function renderMarkdown(
	content: string,
	options: RenderMarkdownOptions = {},
): Promise<RenderedMarkdown> {
	const processor = buildProcessor(options.resolveWikiLink ?? null);
	const data: Record<string, unknown> = {
		frontmatter: options.frontmatter ?? {},
	};
	const file = await processor.process({ value: content, data });
	const fm = (file.data.frontmatter ?? {}) as Record<string, unknown>;
	const headings = (file.data.headings ?? []) as MarkdownHeading[];
	return {
		html: String(file.value),
		headings,
		words: typeof fm.words === "number" ? fm.words : 0,
		minutes: typeof fm.minutes === "number" ? fm.minutes : 0,
		excerpt: typeof fm.excerpt === "string" ? fm.excerpt : "",
		frontmatter: fm,
	};
}

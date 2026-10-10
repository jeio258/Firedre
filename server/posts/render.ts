import { defaultsLocals, getSiteConfig } from "@shared/config/runtime";
import type { WikiLinkResolver } from "@shared/plugins/remark-wiki-link-runtime";
// biome-ignore lint/suspicious/noShadowRestrictedNames: 沿用 mdast-util-toString 原名
import { toString } from "mdast-util-to-string";
import { visit } from "unist-util-visit";
import type { MarkdownHeading } from "../../types/posts";
import { rehypeSanitizeDangerous } from "./sanitize";

const siteConfig = getSiteConfig(defaultsLocals);

// 重型 markdown 依赖链（unified + remark/rehype + markdown-preset + katex/mhchem）**不再顶层静态导入**，
// 改为 buildProcessor 内按需 `await import()`：避免它们进入 Worker 冷启动求值（曾致 CPU 超限 1102）。

export { stripMarkdown } from "./markdown";

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

interface UnifiedProcessor {
	use(...args: unknown[]): UnifiedProcessor;
	process(input: { value: string; data: Record<string, unknown> }): Promise<{
		value: unknown;
		data: { frontmatter?: unknown; headings?: unknown };
	}>;
}

async function buildProcessor(resolveWikiLink: WikiLinkResolver | null) {
	const [
		{ unified },
		{ default: remarkParse },
		{ default: remarkGfm },
		{ default: remarkSmartypants },
		{ default: remarkRehype },
		{ default: rehypeRaw },
		{ default: rehypeStringify },
		{ sharedRemarkPlugins, sharedRehypePlugins },
		{ remarkWikiLinkRuntime },
	] = await Promise.all([
		import("unified"),
		import("remark-parse"),
		import("remark-gfm"),
		import("remark-smartypants"),
		import("remark-rehype"),
		import("rehype-raw"),
		import("rehype-stringify"),
		import("@shared/plugins/markdown-preset.mjs"),
		import("@shared/plugins/remark-wiki-link-runtime"),
	]);
	// mhchem 扩展（副作用：向 katex 注册 mhchem 宏）
	await import("katex/dist/contrib/mhchem.mjs");

	return (unified() as unknown as UnifiedProcessor)
		.use(remarkParse)
		.use(remarkGfm)
		.use(remarkSmartypants)
		.use(
			sharedRemarkPlugins({
				readingTime: remarkReadingTimeLocal,
				wikiLink: [
					remarkWikiLinkRuntime,
					{
						resolve: (contentPath: string) =>
							resolveWikiLink
								? resolveWikiLink(contentPath)
								: Promise.resolve(null),
					},
				],
				excerpt: remarkExcerptLocal,
			}),
		)
		.use(remarkRehype, { allowDangerousHtml: true })
		.use(rehypeRaw)
		.use(rehypeSanitizeDangerous)
		.use(
			sharedRehypePlugins(siteConfig, {
				beforeAutolink: [rehypeCollectHeadings],
			}),
		)
		.use(rehypeStringify, { allowDangerousHtml: true });
}

export async function renderMarkdown(
	content: string,
	options: RenderMarkdownOptions = {},
): Promise<RenderedMarkdown> {
	const processor = await buildProcessor(options.resolveWikiLink ?? null);
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

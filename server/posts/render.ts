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

	/** 按内容特征裁剪重型插件；缺省全部启用，保持既有语义 */
	features?: MarkdownFeatureFlags;
}

export interface MarkdownFeatureFlags {
	math?: boolean;
	callouts?: boolean;
	codeGroup?: boolean;
	diagrams?: boolean;
	github?: boolean;
}

/**
 * 从源码探测所需的 Markdown 特性（只做廉价字符串匹配，无 AST）。
 * 判断保守：命中任一可疑模式就启用，宁多算不漏渲染。
 */
export function detectMarkdownFeatures(
	source: string,
): Required<MarkdownFeatureFlags> {
	// 数学：$...$ / $$...$$（remark-math 语法）
	const math = /\$\$[\s\S]*?\$\$|\$[^$\n]+\$/.test(source);
	// 标注块：:::note / > [!NOTE]（rehype-callouts / admonition）
	const callouts =
		/^:::+|\n:::+|\[!(?:NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i.test(source);
	// 代码分组：` ```group ` 或 tab 语法
	const codeGroup = /```+\s*(?:group|tabs?)\b/i.test(source);
	// 图表：mermaid / plantuml fenced block
	const diagrams = /```+\s*(?:mermaid|plantuml|puml)\b/i.test(source);
	// GitHub 卡片：::github{repo="owner/repo"}
	const github = /::github\{/.test(source);

	return { math, callouts, codeGroup, diagrams, github };
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

async function buildProcessor(
	resolveWikiLink: WikiLinkResolver | null,
	features: Required<MarkdownFeatureFlags>,
) {
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
				math: features.math,
			}),
		)
		.use(remarkRehype, { allowDangerousHtml: true })
		.use(rehypeRaw)
		.use(rehypeSanitizeDangerous)
		.use(
			sharedRehypePlugins(siteConfig, {
				beforeAutolink: [rehypeCollectHeadings],
				features: {
					math: features.math,
					callouts: features.callouts,
					codeGroup: features.codeGroup,
					diagrams: features.diagrams,
					github: features.github,
				},
			}),
		)
		.use(rehypeStringify, { allowDangerousHtml: true });
}

// unified processor 建链成本 15–26ms；插件注册后无请求级可变状态，按身份复用。
// 无解析器（多数页面）按 5 个特性位分桶（至多 32 种组合）；有解析器（文章
// wiki-link）解析器是模块级闭包（buildWikiLinkResolver 每次新建），用 WeakMap
// 以身份为键避免请求泄漏，桶内再按特性位分桶。
const featureKey = (features: Required<MarkdownFeatureFlags>) =>
	[
		features.math ? 1 : 0,
		features.callouts ? 1 : 0,
		features.codeGroup ? 1 : 0,
		features.diagrams ? 1 : 0,
		features.github ? 1 : 0,
	].join("");
const featureProcessors = new Map<string, Promise<UnifiedProcessor>>();
const resolverProcessors = new WeakMap<
	object,
	Map<string, Promise<UnifiedProcessor>>
>();

function getProcessor(
	resolveWikiLink: WikiLinkResolver | null,
	features: Required<MarkdownFeatureFlags>,
): Promise<UnifiedProcessor> {
	const key = featureKey(features);
	if (!resolveWikiLink) {
		let cached = featureProcessors.get(key);
		if (!cached) {
			cached = buildProcessor(null, features);
			featureProcessors.set(key, cached);
		}
		return cached;
	}
	let buckets = resolverProcessors.get(resolveWikiLink as object);
	if (!buckets) {
		buckets = new Map();
		resolverProcessors.set(resolveWikiLink as object, buckets);
	}
	let cached = buckets.get(key);
	if (!cached) {
		cached = buildProcessor(resolveWikiLink, features);
		buckets.set(key, cached);
	}
	return cached;
}

export async function renderMarkdown(
	content: string,
	options: RenderMarkdownOptions = {},
): Promise<RenderedMarkdown> {
	const features = {
		math: true,
		callouts: true,
		codeGroup: true,
		diagrams: true,
		github: true,
		...options.features,
	} as Required<MarkdownFeatureFlags>;
	const processor = await getProcessor(
		options.resolveWikiLink ?? null,
		features,
	);
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

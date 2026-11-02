import katex from "katex";
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
import { GithubCardComponent } from "./rehype-component-github-card.mjs";
import { rehypeDiagramPanZoom } from "./rehype-diagram-panzoom.mjs";
import rehypeEmailProtection from "./rehype-email-protection.mjs";
import rehypeExternalLinks from "./rehype-external-links.mjs";
import rehypeFigure from "./rehype-figure.mjs";
import rehypeImageReferrerPolicy from "./rehype-image-referrerpolicy.mjs";
import { rehypePlantuml } from "./rehype-plantuml.mjs";
import { parseDirectiveNode } from "./remark-directive-rehype.js";
import { remarkImageGrid } from "./remark-image-grid.js";
import { remarkMermaid } from "./remark-mermaid.js";
import { remarkPlantuml } from "./remark-plantuml.js";

// 运行时渲染链（server/posts/render.ts）的共享插件集合；差异项由调用方注入。

/**
 * @param {{ admonition?: boolean, readingTime?: unknown, wikiLink?: unknown, excerpt?: unknown, math?: boolean }} [options]
 * @returns {{ plugins: any[] }}
 */
export function sharedRemarkPlugins({
	admonition = true,
	readingTime,
	wikiLink,
	excerpt,
	math = true,
}) {
	const plugins = [];
	if (admonition) plugins.push(remarkAdmonitionToBlockquoteCallout);
	plugins.push(
		// 按内容特征裁剪：只为「内容里确实出现的语法」装配对应插件，
		// 语义不变（未出现的语法本就产出空结果）。Cloudflare Pages Functions
		// （Free 套餐）单次调用 CPU 上限 10ms，全量插件链实测中位数 7~15ms，
		// 超限即 Error 1102（随机 503）。
		...(math ? [remarkMath] : []),
		readingTime,
		wikiLink,
		remarkImageGrid,
		excerpt,
		remarkDirective,
		remarkSectionize,
		parseDirectiveNode,
		remarkMermaid,
		remarkPlantuml,
	);
	return { plugins };
}

/**
 * @param {any} siteConfig
 * @param {{ afterCodeGroup?: any[], beforeAutolink?: any[], features?: { math?: boolean, callouts?: boolean, codeGroup?: boolean, diagrams?: boolean, github?: boolean } }} [options]
 * @returns {{ plugins: any[] }}
 */
export function sharedRehypePlugins(
	siteConfig,
	{ afterCodeGroup = [], beforeAutolink = [], features = {} } = {},
) {
	const {
		math = true,
		callouts = true,
		codeGroup = true,
		diagrams = true,
		github = true,
	} = features;
	const plugins = [
		...(math ? [[rehypeKatex, { katex }]] : []),
		...(callouts
			? [[rehypeCallouts, { theme: siteConfig.post.rehypeCallouts.theme }]]
			: []),
		rehypeSlug,
		...(codeGroup ? [rehypeCodeGroup] : []),
		...afterCodeGroup,
		...(diagrams ? [rehypePlantuml, rehypeDiagramPanZoom] : []),
		rehypeFigure,
		[
			rehypeImageReferrerPolicy,
			{ domains: siteConfig.imageOptimization?.noReferrerDomains || [] },
		],
		[rehypeExternalLinks, { siteUrl: siteConfig.site_url }],
		[rehypeEmailProtection, { method: "base64" }],
		...(github
			? [[rehypeComponents, { components: { github: GithubCardComponent } }]]
			: []),
		...beforeAutolink,
		[
			rehypeAutolinkHeadings,
			{
				behavior: "append",
				properties: {
					className: ["anchor"],
				},
				content: {
					type: "element",
					tagName: "span",
					properties: {
						className: ["anchor-icon"],
						"data-pagefind-ignore": true,
					},
					children: [{ type: "text", value: "#" }],
				},
			},
		],
	];
	return { plugins };
}

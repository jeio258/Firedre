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

// 两条 markdown 渲染链（构建期 astro.config / 运行时 server/posts/render.ts）
// 共享的插件集合；差异项（wikiLink/readingTime/excerpt/mermaid/collectHeadings 等）由调用方注入。

export function sharedRemarkPlugins({
	admonition = true,
	readingTime,
	wikiLink,
	excerpt,
}) {
	const plugins = [];
	if (admonition) plugins.push(remarkAdmonitionToBlockquoteCallout);
	plugins.push(
		remarkMath,
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

export function sharedRehypePlugins(
	siteConfig,
	{ afterCodeGroup = [], beforeAutolink = [] } = {},
) {
	const plugins = [
		[rehypeKatex, { katex }],
		[rehypeCallouts, { theme: siteConfig.post.rehypeCallouts.theme }],
		rehypeSlug,
		rehypeCodeGroup,
		...afterCodeGroup,
		rehypePlantuml,
		rehypeDiagramPanZoom,
		rehypeFigure,
		[
			rehypeImageReferrerPolicy,
			{ domains: siteConfig.imageOptimization?.noReferrerDomains || [] },
		],
		[rehypeExternalLinks, { siteUrl: siteConfig.site_url }],
		[rehypeEmailProtection, { method: "base64" }],
		[rehypeComponents, { components: { github: GithubCardComponent } }],
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

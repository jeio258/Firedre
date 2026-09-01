// Type declarations for JavaScript/MJS plugin files
declare module '*.js' {
	import type { Pluggable } from 'unified';
	const plugin: Pluggable;
	export default plugin;
	export const remarkImageGrid: Pluggable;
	export const remarkMermaid: Pluggable;
	export const remarkPlantuml: Pluggable;
	export const remarkExcerpt: Pluggable;
	export const parseDirectiveNode: Pluggable;
}

declare module '*.mjs' {
	import type { Pluggable } from 'unified';
	const plugin: Pluggable;
	export default plugin;
	export const remarkReadingTime: Pluggable;
	export const rehypeFigure: Pluggable;
	export const rehypeImageReferrerPolicy: Pluggable;
	export const rehypePlantuml: Pluggable;
	export const rehypeDiagramPanZoom: Pluggable;
	export const rehypeEmailProtection: Pluggable;
	export const rehypeExternalLinks: Pluggable;
	export const GithubCardComponent: any;
}

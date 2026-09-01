

declare module "*.astro" {
	import type { AstroComponentFactory } from "astro/runtime/server/index.js";

	const component: AstroComponentFactory;
	export default component;
}

declare module "*.md?raw" {
	const source: string;
	export default source;
}

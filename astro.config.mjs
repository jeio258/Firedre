import { setMaxListeners } from "node:events";
import cloudflare from "@astrojs/cloudflare";
import { unified } from "@astrojs/markdown-remark";
import mdx from "@astrojs/mdx";
import svelte from "@astrojs/svelte";
import swup from "@swup/astro";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, fontProviders } from "astro/config";
import icon from "astro-icon";
import katex from "katex";
import "katex/dist/contrib/mhchem.mjs"; // 加载 mhchem 扩展
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeCallouts from "rehype-callouts";
import rehypeCodeGroup from "rehype-code-group"; /* Tab 代码块 */
import rehypeComponents from "rehype-components"; /* Render the custom directive content */
import rehypeKatex from "rehype-katex";
import rehypeSlug from "rehype-slug";
import remarkAdmonitionToBlockquoteCallout from "remark-admonition-to-blockquote-callout";
import remarkDirective from "remark-directive"; /* Handle directives */
import remarkMath from "remark-math";
import remarkSectionize from "remark-sectionize";
import {
	fontConfig,
	fontsList,
	mermaidConfig,
	plantumlConfig,
	siteConfig,
} from "./src/config";
import I18nKey from "./src/i18n/i18nKey";
import { i18n } from "./src/i18n/translation";
import { GithubCardComponent } from "./src/plugins/rehype-component-github-card.mjs";
import { rehypeDiagramPanZoom } from "./src/plugins/rehype-diagram-panzoom.mjs";
import rehypeEmailProtection from "./src/plugins/rehype-email-protection.mjs";
import rehypeExternalLinks from "./src/plugins/rehype-external-links.mjs";
import rehypeFigure from "./src/plugins/rehype-figure.mjs";
import rehypeImageReferrerPolicy from "./src/plugins/rehype-image-referrerpolicy.mjs";
import { rehypeMermaid } from "./src/plugins/rehype-mermaid.mjs";
import { rehypePlantuml } from "./src/plugins/rehype-plantuml.mjs";
import { parseDirectiveNode } from "./src/plugins/remark-directive-rehype.js";
import { remarkExcerpt } from "./src/plugins/remark-excerpt.js";
import { remarkImageGrid } from "./src/plugins/remark-image-grid.js";
import { remarkMermaid } from "./src/plugins/remark-mermaid.js";
import { remarkPlantuml } from "./src/plugins/remark-plantuml.js";
import { remarkReadingTime } from "./src/plugins/remark-reading-time.mjs";
import { remarkWikiLink } from "./src/plugins/remark-wiki-link.js";
import { collectUsedFontCssVars } from "./src/utils/fontHelper";

if (process.env.NODE_ENV === "development") {
	setMaxListeners(20);
}

const adapter = cloudflare({
	imageService: "passthrough",
});

// https://astro.build/config
export default defineConfig({
	site: siteConfig.site_url,

	// Firedre：全站 SSR（纯动态），Cloudflare Workers + Static Assets
	output: "server",

	define: {
		__FIREFLY_VERSION__: JSON.stringify("6.16.5"),
	},

	base: "/",
	trailingSlash: "always",

	// 使用自有 Cookie 会话，禁用 Astro Sessions 的 KV 自动供给
	session: false,

	// API 驱动的站点：关闭 Origin 校验（会话 Cookie 为 HttpOnly + SameSite=Lax）
	security: {
		checkOrigin: false,
	},

	// 字体配置 - 只加载实际使用的字体，跳过未引用的以加快构建
	fonts: (() => {
		// 禁用字体功能时直接返回空数组，跳过 Astro Font API 集成
		if (!fontConfig.enable) return [];

		const used = collectUsedFontCssVars(fontConfig);
		return fontsList
			.filter((f) => used.has(f.cssVariable))
			.map((f) => {
				let provider;
				switch (f.provider) {
					case "google":
						provider = fontProviders.google();
						break;
					case "fontsource":
						provider = fontProviders.fontsource();
						break;
					case "local":
						provider = fontProviders.local();
						break;
					case "bunny":
						provider = fontProviders.bunny();
						break;
					case "fontshare":
						provider = fontProviders.fontshare();
						break;
					case "npm":
						provider = fontProviders.npm();
						break;
					default:
						provider = f.provider;
				}
				return { ...f, provider };
			});
	})(),

	adapter,

	// 图像优化配置
	image: {
		// 组件可自行传入 layout/widths；这里只控制 Markdown 正文图片
		layout: "none",
	},

	integrations: [
		swup({
			theme: false,
			// 关键：禁用 swup 内存页面缓存。否则前台软导航显示缓存旧 DOM，
			// 后台改配置后前台永远不更新（表现为"配置不生效"）
			cache: false,
			animationClass: "transition-swup-", // see https://swup.js.org/options/#animationselector
			// the default value `transition-` cause transition delay
			// when the Tailwind class `transition-all` is used
			containers: [
				"#banner-overlay-container",
				"#banner-dim-container",
				"#swup-container",
				"#left-sidebar-dynamic",
				"#right-sidebar-dynamic",
				"#floating-toc-wrapper",
			],
			smoothScrolling: false,
			cache: true,
			preload: {
				hover: true,
				visible: true,
			},
			accessibility: true,
			updateHead: true,
			updateBodyClass: false,
			globalInstance: true,
			// 滚动相关配置优化
			resolveUrl: (url) => url,
			animateHistoryBrowsing: false,
			skipPopStateHandling: (event) => {
				// 跳过锚点链接的处理，让浏览器原生处理
				return event.state?.url?.includes("#");
			},
		}),
		icon({
			include: {
				"material-symbols": [
					"airwave-rounded", "archive", "arrow-back", "arrow-drop-down-rounded", "arrow-outward-rounded", "article", "article-outline", "auto-stories-outline-rounded", "book-2-outline-rounded", "bookmark-rounded", "bookmarks", "border-outer-rounded", "brightness-auto-outline-rounded", "build-outline", "build-outline-rounded", "calendar-clock-outline", "calendar-month-outline-rounded", "calendar-month-rounded", "calendar-today", "calendar-today-outline-rounded", "chat", "chat-bubble-outline-rounded", "check", "chevron-left-rounded", "chevron-right-rounded", "chrome-reader-mode-rounded", "close", "close-fullscreen-rounded", "cloud-outline", "code-rounded", "computer-outline", "copyright-outline", "dark-mode-outline-rounded", "docs", "download", "dynamic-feed-rounded", "edit-calendar-outline-rounded", "emoji-people-rounded", "error-outline", "expand-more-rounded", "favorite", "folder-off", "folder-open", "folder-open-rounded", "folder-outline", "format-list-bulleted", "format-quote-rounded", "forum-rounded", "full-coverage-outline-rounded", "gradient", "group", "group-off-outline", "help-outline", "hide-image-outline", "history-rounded", "home", "home-outline-rounded", "home-pin-outline", "image-outline", "info", "info-outline", "ink-pen-outline-rounded", "keyboard-arrow-down-rounded", "keyboard-arrow-up-rounded", "label-outline", "language", "layers", "link", "link-2-rounded", "link-rounded", "location-on", "location-on-rounded", "lock-outline", "menu-book", "menu-rounded", "more-horiz", "movie", "movie-filter", "music-note-rounded", "notes-rounded", "palette", "palette-outline", "palette-outline", "pause-rounded", "person", "photo-library", "pinboard", "play-arrow-rounded", "keep", "recommend", "repeat-one-rounded", "repeat-rounded", "rocket-launch-outline", "rss-feed", "schedule-outline-rounded", "search", "search-off", "search-off-rounded", "search-rounded", "sentiment-sad", "settings", "share", "shield-lock", "shuffle-rounded", "signpost", "skip-next-rounded", "skip-previous-rounded", "subtitles-off-outline-rounded", "subtitles-outline-rounded", "sync-rounded", "tag-rounded", "text-ad-outline-rounded", "titlecase-rounded", "update-rounded", "view-carousel-outline", "visibility-outline-rounded", "volume-off-rounded", "volume-up-rounded", "wallpaper", "wb-sunny-outline-rounded", "zoom-in-rounded", "admin-panel-settings"
				],
				"fa7-brands": [
					"alipay", "bilibili", "creative-commons", "creative-commons-pd", "creative-commons-zero", "gitee", "github", "node-js", "osi", "qq", "weixin"
				],
				"fa7-regular": ["address-card", "copyright"],
				"fa7-solid": [
					"arrow-right", "arrow-rotate-left", "arrow-up-right-from-square", "chevron-left", "chevron-right", "envelope", "rss", "xmark"
				],
				"mdi": [
					"arrow-up", "bed", "clover", "flower-poppy", "github", "home", "playlist-music", "swap-horizontal"
				],
				"mingcute": ["comment-line", "heartbeat-line"],
				"simple-icons": ["afdian", "kofi", "pnpm"],
				"svg-spinners": ["ring-resize"],
			},
		}),
		// expressive-code 集成已移除：代码高亮改由客户端 highlight.js 承担（大幅减小 Worker 体积）
		
		svelte(),
		mdx(),
	],
	markdown: {
		// Firedre：文章/页面内容由运行时渲染管线（server/posts/render.ts）处理，
		// 关闭 Astro 内置 shiki 语法高亮以大幅减小 Worker 体积（代码高亮改由客户端 highlight.js 承担）
		syntaxHighlight: false,
		processor: unified({
			remarkPlugins: [
				...(siteConfig.post.rehypeCallouts.enablePythonMarkdownAdmonitions !==
				false
					? [remarkAdmonitionToBlockquoteCallout]
					: []),
				remarkMath,
				remarkReadingTime,
				remarkWikiLink,
				remarkImageGrid,
				remarkExcerpt,
				remarkDirective,
				remarkSectionize,
				parseDirectiveNode,
				remarkMermaid,
				[remarkPlantuml, plantumlConfig],
			],
			rehypePlugins: [
				[rehypeKatex, { katex }],
				[rehypeCallouts, { theme: siteConfig.post.rehypeCallouts.theme }],
				rehypeSlug,
				rehypeCodeGroup,
				[rehypeMermaid, mermaidConfig],
				rehypePlantuml,
				rehypeDiagramPanZoom,
				rehypeFigure,
				[
					rehypeImageReferrerPolicy,
					{ domains: siteConfig.imageOptimization?.noReferrerDomains || [] },
				],
				[rehypeExternalLinks, { siteUrl: siteConfig.site_url }],
				[rehypeEmailProtection, { method: "base64" }], // 邮箱保护插件，支持 'base64' 或 'rot13'
				[
					rehypeComponents,
					{
						components: {
							github: GithubCardComponent,
						},
					},
				],
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
							children: [
								{
									type: "text",
									value: "#",
								},
							],
						},
					},
				],
			],
		}),
	},
	vite: {
		plugins: [
			tailwindcss(),
			// 纯 astro dev（v12 适配器，非 workerd）时 cloudflare:workers 不可用，垫片避免模块加载崩溃
			{
				name: "firedre:cf-env-dev-shim",
				config(config) {
					// v12 适配器的 astro dev 运行在 Node（非 workerd），cloudflare:workers 由垫片提供；
					// 生产构建/部署必须保持真实 CF env（D1/R2/secrets），不做替换。
					if (
						process.env.NODE_ENV !== "production" &&
						!process.env.CF_PAGES
					) {
						config.resolve ||= {};
						config.resolve.alias ||= [];
						config.resolve.alias.push({
							find: "cloudflare:workers",
							replacement: new URL("./src/lib/cf-dev-shim.ts", import.meta.url).pathname,
						});
					}
				},
				resolveId(source) {
					if (
						source === "cloudflare:workers" &&
						process.env.NODE_ENV !== "production" &&
						!process.env.CF_PAGES
					) {
						return "\0firedre-cf-env-shim";
					}
					return null;
				},
				load(id) {
					if (id === "\0firedre-cf-env-shim")
						return `export { env, context, caches } from ${JSON.stringify(new URL("./src/lib/cf-dev-shim.ts", import.meta.url).pathname)};`;
					return null;
				},
			},
		],
		server: {
			watch: {
				ignored: [
					"**/package/**",
					"**/Firefly-docs/**",
					"**/.wrangler/**",
					"**/.astro/**",
					"**/dist/**",
				],
			},
		},
		resolve: {
			alias: {
				"@rehype-callouts-theme": `rehype-callouts/theme/${siteConfig.post.rehypeCallouts.theme}`,
				// prism 从不启用：stub 掉 @astrojs/prism，规避 v12 适配器 workerd loader 与 rolldown 的冲突
				"@astrojs/prism/dist/highlighter": new URL("./src/lib/prism-stub.ts", import.meta.url).pathname,
				"@astrojs/prism/dist/loadLanguages-workerd": new URL("./src/lib/prism-stub.ts", import.meta.url).pathname,
				"@astrojs/prism": new URL("./src/lib/prism-stub.ts", import.meta.url).pathname,
			},
		},
		optimizeDeps: {
			// workerd dev 下 SSR 依赖预优化产物（.vite/deps_ssr/*.js）在 workerd 里访问不到，
			// 触发「file does not exist」崩溃（上游 bug #16248/#17456）。排除 astro: 虚拟模块规避。
			exclude: [
				"astro:assets",
				"astro/assets/services/noop",
				"astro:actions",
			],
			// 后台文章编辑器动态加载 Vditor（AdminPostEditor 按需 import）。
			// 显式预优化，避免 dev 下首次访问出现 Outdated Optimize Dep (504) 导致编辑器加载失败。
			include: ["vditor"],
		},
		build: {
			minify: "esbuild",
			esbuildOptions: {
				minify: true,
				// 删除 debugger 语句；console.log / console.debug 无副作用，未使用返回值时会被 dead code elimination 移除，
				// console.warn / console.error 保留，确保生产环境出错时仍有日志可查
				drop: ["debugger"],
				pure: ["console.log", "console.debug"],
			},
			rollupOptions: {
				onwarn(warning, warn) {
					// temporarily suppress this warning
					if (
						warning.message.includes("is dynamically imported by") &&
						warning.message.includes("but also statically imported by")
					) {
						return;
					}
					warn(warning);
				},
			},
			// CSS 优化
			cssCodeSplit: true,
			cssMinify: "esbuild",
			assetsInlineLimit: 4096,
		},
	},
});

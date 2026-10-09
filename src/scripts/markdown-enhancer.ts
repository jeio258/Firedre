import {
	DIAGRAM_CONTAINER,
	MERMAID_CONTAINER,
	MERMAID_ERROR,
	MERMAID_SVG_DARK,
	MERMAID_SVG_LIGHT,
	MERMAID_WRAPPER,
} from "@shared/plugins/utils/diagramConstants";
import { mermaidConfig } from "@/config";

// Markdown 增强器：hljs 高亮 + mermaid 渲染（纯命令式 DOM 操作，无框架水合）
// 以模块脚本运行（defer），替代原 Svelte client:load 岛，省去 58.8KB 运行时

let hljsReady = false;

function loadHighlightJs(): Promise<void> {
	if (hljsReady) return Promise.resolve();
	if ((window as unknown as { hljs?: unknown }).hljs) {
		hljsReady = true;
		return Promise.resolve();
	}
	return new Promise((resolve) => {
		const script = document.createElement("script");
		script.src = "/assets/js/highlight.min.js";
		script.onload = () => {
			hljsReady = true;
			resolve();
		};
		script.onerror = () => resolve();
		document.head.appendChild(script);
		injectHighlightTheme();
	});
}

// 代码块高亮主题跟随深浅模式：注入对应 hljs css（浅色/深色两套资源）
let highlightThemeObserver: MutationObserver | null = null;
function injectHighlightTheme(): void {
	const isDark = document.documentElement.classList.contains("dark");
	const href = isDark
		? "/assets/css/highlight-github-dark.min.css"
		: "/assets/css/highlight-github-light.min.css";
	const selector = "link[data-highlight-theme]";
	const existing = document.head.querySelector<HTMLLinkElement>(selector);
	if (existing) {
		if (existing.href.endsWith(href)) return;
		existing.href = href;
	} else {
		const link = document.createElement("link");
		link.rel = "stylesheet";
		link.dataset.highlightTheme = "";
		link.href = href;
		document.head.appendChild(link);
	}
	// 主题切换（深/浅）时跟随更新
	if (!highlightThemeObserver) {
		highlightThemeObserver = new MutationObserver(() => injectHighlightTheme());
		highlightThemeObserver.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["class"],
		});
	}
}

async function highlight(root: ParentNode) {
	if (!root.querySelector("pre code")) return;
	try {
		await loadHighlightJs();
	} catch {
		return;
	}
	const hljs = (
		window as unknown as {
			hljs?: { highlightElement: (el: HTMLElement) => void };
		}
	).hljs;
	if (!hljs) return;
	root.querySelectorAll<HTMLElement>("pre code:not(.hljs)").forEach((el) => {
		try {
			// hljs 11+ 仅提供 highlightElement
			hljs.highlightElement(el);
		} catch {
			// 单块失败不影响其它
		}
	});
}

async function renderMermaid(root: ParentNode) {
	// 后台站点设置可关闭 Mermaid 渲染
	const settings = (
		window as unknown as {
			__FIREFLY_SETTINGS__?: {
				mermaid?: {
					enabled?: boolean;
					lightTheme?: string;
					darkTheme?: string;
				};
			};
		}
	).__FIREFLY_SETTINGS__;
	if (settings?.mermaid?.enabled === false) return;
	// 主题跟随后台设置（runtime），静态 mermaidConfig 仅作构建期兜底
	const lightTheme = (settings?.mermaid?.lightTheme ||
		mermaidConfig.lightTheme) as typeof mermaidConfig.lightTheme;
	const darkTheme = (settings?.mermaid?.darkTheme ||
		mermaidConfig.darkTheme) as typeof mermaidConfig.darkTheme;
	const containers = Array.from(
		root.querySelectorAll<HTMLElement>(
			"div.mermaid-container[data-mermaid-code]",
		),
	);
	if (!containers.length) return;
	try {
		const [{ initMerman, renderSvg }, wasmModule] = await Promise.all([
			import("@mermanjs/web/render"),
			import("@mermanjs/web/pkg/render/merman_wasm_bg.wasm?url"),
		]);
		await initMerman({ wasm: { module_or_path: wasmModule.default } });

		containers.forEach((container, index) => {
			const code = container.dataset.mermaidCode || "";
			try {
				const light = renderSvg(code, {
					host_theme: { preset: lightTheme },
					svg: { diagram_id: `mermaid-${index}-light`, pipeline: "parity" },
				});
				const dark = renderSvg(code, {
					host_theme: { preset: darkTheme },
					svg: { diagram_id: `mermaid-${index}-dark`, pipeline: "parity" },
				});
				container.outerHTML =
					`<div class="${DIAGRAM_CONTAINER} ${MERMAID_CONTAINER}">` +
					`<div class="${MERMAID_WRAPPER}">` +
					`<div class="${MERMAID_SVG_LIGHT}">${light}</div>` +
					`<div class="${MERMAID_SVG_DARK}">${dark}</div>` +
					"</div></div>";
			} catch {
				container.outerHTML =
					`<div class="${DIAGRAM_CONTAINER} ${MERMAID_CONTAINER} ${MERMAID_ERROR}">` +
					`<pre><code>${code.replace(/</g, "&lt;")}</code></pre></div>`;
			}
		});
	} catch {
		// WASM 加载失败：保留原始代码块，用户仍可阅读
	}
}

declare global {
	interface Window {
		__MD_ENHANCER_INIT__?: boolean;
	}
}

// swup 软导航下 bundled 脚本可能重执行，window 守卫保证监听器只注册一次
if (!window.__MD_ENHANCER_INIT__) {
	window.__MD_ENHANCER_INIT__ = true;
	renderMermaid(document);
	highlight(document);
	document.addEventListener("astro:page-load", () => {
		renderMermaid(document);
		highlight(document);
	});
}

// Markdown 增强器：hljs 高亮 + mermaid 渲染（纯命令式 DOM 操作，无框架水合）
// 以模块脚本运行（defer），替代原 Svelte client:load 岛，省去 58.8KB 运行时
import { mermaidConfig } from "@shared/config/mermaidConfig";

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
		// 与脚本同时注入高亮样式（仅按需时加载，避免无代码块页面白耗）
		if (
			!document.querySelector(
				'link[href="/assets/css/highlight-github-dark.min.css"]',
			)
		) {
			const link = document.createElement("link");
			link.rel = "stylesheet";
			link.href = "/assets/css/highlight-github-dark.min.css";
			document.head.appendChild(link);
		}
	});
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
			// hljs 11+ 仅暴露 highlightElement（旧版函数式调用已移除）
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
			__FIREFLY_SETTINGS__?: { mermaid?: { enabled?: boolean } };
		}
	).__FIREFLY_SETTINGS__;
	if (settings?.mermaid?.enabled === false) return;
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
					host_theme: { preset: mermaidConfig.lightTheme },
					svg: { diagram_id: `mermaid-${index}-light`, pipeline: "parity" },
				});
				const dark = renderSvg(code, {
					host_theme: { preset: mermaidConfig.darkTheme },
					svg: { diagram_id: `mermaid-${index}-dark`, pipeline: "parity" },
				});
				container.outerHTML =
					`<div class="diagram-container mermaid-diagram-container">` +
					`<div class="mermaid-wrapper">` +
					`<div class="mermaid-svg-light">${light}</div>` +
					`<div class="mermaid-svg-dark">${dark}</div>` +
					"</div></div>";
			} catch {
				container.outerHTML =
					`<div class="diagram-container mermaid-diagram-container mermaid-error">` +
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

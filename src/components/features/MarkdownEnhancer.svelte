<script lang="ts">
import { onMount } from "svelte";
import { mermaidConfig } from "@/config/mermaidConfig";

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
	});
}

async function highlight(root: ParentNode) {
	try {
		await loadHighlightJs();
	} catch {
		return;
	}
	const hljs = (window as unknown as { hljs?: (el: HTMLElement) => void }).hljs;
	if (!hljs) return;
	root.querySelectorAll<HTMLElement>("pre code:not(.hljs)").forEach((el) => {
		try {
			hljs(el);
		} catch {
			// 单块失败不影响其它
		}
	});
}

async function renderMermaid(root: ParentNode) {
	// Firedre：后台站点设置可关闭 Mermaid 渲染
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

const onContentReplaced = () => {
	renderMermaid(document);
	highlight(document);
};

onMount(() => {
	renderMermaid(document);
	highlight(document);
	document.addEventListener("swup:contentReplaced", onContentReplaced);
	document.addEventListener("swup:content:replace", onContentReplaced);

	return () => {
		document.removeEventListener("swup:contentReplaced", onContentReplaced);
		document.removeEventListener("swup:content:replace", onContentReplaced);
	};
});
</script>

<svelte:head>
	<link rel="stylesheet" href="/assets/css/highlight-github-dark.min.css" />
</svelte:head>

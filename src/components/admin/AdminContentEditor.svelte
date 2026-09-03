<script lang="ts">
	import { onDestroy, onMount, tick } from "svelte";
	import "vditor/dist/index.css";
	import type Vditor from "vditor";
	import { observeVditorTheme, syncVditorTheme } from "@/lib/adminVditor";

	let { section = "about", apiPath = "/api/about/" } = $props();

	let editor: Vditor | null = null;
	let vditorThemeObserver: MutationObserver | null = null;
	let rawContent = $state("");
	let saving = $state(false);
	let message = $state("");
	let loaded = $state(false);

	const titles: Record<string, string> = {
		about: "关于页",
	};

	async function load() {
		try {
			const resp = await fetch(apiPath);
			if (resp.ok) {
				const data = await resp.json();
				rawContent = data.source ?? "";
			}
			loaded = true;
			await tick();
			initEditor();
		} catch {
			message = "加载失败";
			loaded = true;
		}
	}

	async function initEditor() {
		if (editor) {
			editor.setValue(rawContent);
			return;
		}

		const { default: Vditor } = await import("vditor");
		editor = new Vditor("vditor-editor", {
			cdn: "/vditor",
			height: 520,
			mode: "wysiwyg",
			value: rawContent,
			cache: { enable: false },
			after: () => {
				const root = document.querySelector<HTMLElement>(".vditor");
				if (root) {
					syncVditorTheme(root);
					vditorThemeObserver = observeVditorTheme(root);
				}
			},
		});
	}

	async function save() {
		saving = true;
		message = "";
		const content = editor ? editor.getValue() : rawContent;
		if (!content.trim()) {
			message = "内容不能为空";
			saving = false;
			return;
		}
		try {
			const resp = await fetch(apiPath, {
				method: "PUT",
				headers: { "Content-Type": "text/markdown" },
				body: content,
			});
			const data = await resp.json();
			if (!resp.ok || !data.ok) {
				message = data.message || "保存失败";
				return;
			}
			message = "已保存";
		} catch {
			message = "网络错误";
		} finally {
			saving = false;
		}
	}

	onMount(load);
	onDestroy(() => vditorThemeObserver?.disconnect());
</script>

<div class="crud-page">
	<div class="crud-head">
		<div>
			<h2>{titles[section] || "内容编辑"}</h2>
			<p class="crud-sub">编辑 about/index.md（frontmatter + Markdown 正文）</p>
		</div>
		<div class="crud-head-actions">
			{#if message}
				<span class="crud-msg">{message}</span>
			{/if}
			<button class="btn-primary" on:click={save} disabled={saving}>
				{saving ? "保存中…" : "保存"}
			</button>
		</div>
	</div>

	{#if loaded}
		<div id="vditor-editor"></div>
	{:else}
		<div class="crud-empty">{message || "加载中…"}</div>
	{/if}
</div>
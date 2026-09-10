<script lang="ts">
	import { onDestroy, onMount, tick } from "svelte";
	import "vditor/dist/index.css";
	import type Vditor from "vditor";
	import { createAdminVditor } from "@/lib/adminVditor";
	import { registerSaveAll } from "@/lib/adminSave";
	import { getDraft, clearDraft } from "@/lib/adminDrafts";

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

		editor = await createAdminVditor("vditor-editor", {
			value: rawContent,
			height: 520,
			onThemeObserver: (mo) => (vditorThemeObserver = mo),
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
		clearDraft("关于页");
	} catch {
		message = "网络错误";
	} finally {
		saving = false;
	}
}

	onMount(async () => {
		await load();
		const d = getDraft<{ content?: string }>("关于页");
		if (d?.content != null) {
			rawContent = d.content;
			if (editor) editor.setValue(d.content);
			clearDraft("关于页");
		}
		return registerSaveAll("关于页", save, () => ({
			content: editor ? editor.getValue() : rawContent,
		}));
	});
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
			<button class="btn-primary" onclick={save} disabled={saving}>
				{saving ? "保存中…" : "保存"}
			</button>
		</div>
	</div>

	{#if loaded}
		<div class="card editor-body">
			<div id="vditor-editor"></div>
		</div>
	{:else}
		<div class="crud-empty">{message || "加载中…"}</div>
	{/if}
</div>
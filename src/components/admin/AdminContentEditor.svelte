<script lang="ts">
import { onMount, tick } from "svelte";
import "vditor/dist/index.css";
import type Vditor from "vditor";

export let section = "about";
export let apiPath = "/api/about/";

let editor: Vditor | null = null;
let rawContent = "";
let saving = false;
let message = "";
let loaded = false;

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
		mode: "ir",
		value: rawContent,
		cache: { enable: false },
		after: () => {
			// 初始化完成
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
		message = "已保存 ✓";
	} catch {
		message = "网络错误";
	} finally {
		saving = false;
	}
}

onMount(load);
</script>

<div class="admin-card">
	<div class="toolbar">
		<h2>{titles[section] || "内容编辑"}</h2>
		<div class="actions">
			{#if message}
				<span class="msg">{message}</span>
			{/if}
			<button class="btn-primary" on:click={save} disabled={saving}>
				{saving ? "保存中…" : "保存"}
			</button>
		</div>
	</div>
	<p class="hint">编辑 about/index.md（frontmatter 中的 title/cover 等 + Markdown 正文）</p>
	{#if loaded}
		<div id="vditor-editor"></div>
	{:else}
		<p>{message || "加载中…"}</p>
	{/if}
</div>

<style>
	.toolbar {
		margin-bottom: 0.5rem;
	}
	.hint {
		color: var(--muted, #6b7280);
		font-size: 0.82rem;
		margin: 0 0 1rem;
	}
</style>

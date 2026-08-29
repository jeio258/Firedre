<script lang="ts">
import { onMount, tick } from "svelte";
import Vditor from "vditor";
import "vditor/dist/index.css";

export let slug = "";

let editor: Vditor | null = null;
let rawSource = "";
let loaded = false;
let saving = false;
let message = "";

async function load() {
	try {
		const resp = await fetch(`/api/gallery/${encodeURIComponent(slug)}/`);
		if (resp.ok) {
			const data = await resp.json();
			rawSource = data.source ?? "";
		}
		loaded = true;
		await tick();
		initEditor();
	} catch {
		message = "加载失败";
		loaded = true;
	}
}

function initEditor() {
	if (editor) {
		editor.setValue(rawSource);
		return;
	}
	editor = new Vditor("vditor-editor", {
		cdn: "/vditor",
		height: 520,
		mode: "ir",
		value: rawSource,
		cache: { enable: false },
		after: () => {
			// 初始化完成
		},
	});
}

async function save() {
	saving = true;
	message = "";
	const content = editor ? editor.getValue() : rawSource;
	if (!content.trim()) {
		message = "内容不能为空";
		saving = false;
		return;
	}
	try {
		const resp = await fetch(`/api/gallery/${encodeURIComponent(slug)}/`, {
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
		<h2>相册：{slug}</h2>
		<div class="actions">
			{#if message}
				<span class="msg">{message}</span>
			{/if}
			<button class="btn-primary" on:click={save} disabled={saving}>
				{saving ? "保存中…" : "保存"}
			</button>
			<a class="btn" href="/admin/gallery/">返回相册列表</a>
		</div>
	</div>
	<p class="hint">
		编辑 gallery/{slug}/index.md。frontmatter 支持 title/desc/date/location/tags/encrypted/password/photos（URL 列表）/source
		（webdav 时需配置 webdav.url 与 username）。
	</p>
	{#if loaded}
		<div id="vditor-editor"></div>
	{:else}
		<p>{message || "加载中…"}</p>
	{/if}
</div>

<style>
	.admin-card {
		background: #fff;
		border: 1px solid #e5e7eb;
		border-radius: 0.75rem;
		padding: 1.25rem;
	}
	.toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.5rem;
	}
	h2 {
		font-size: 1.1rem;
		margin: 0;
	}
	.actions {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}
	.msg {
		color: #16a34a;
		font-size: 0.85rem;
	}
	.btn {
		padding: 0.5rem 0.9rem;
		border: 1px solid #d1d5db;
		border-radius: 0.4rem;
		text-decoration: none;
		font-size: 0.9rem;
		color: #374151;
	}
	.btn-primary {
		padding: 0.5rem 0.9rem;
		background: var(--primary, #5b8cff);
		color: #fff;
		border: none;
		border-radius: 0.4rem;
		cursor: pointer;
	}
	.hint {
		color: #6b7280;
		font-size: 0.82rem;
		margin: 0 0 1rem;
	}
</style>

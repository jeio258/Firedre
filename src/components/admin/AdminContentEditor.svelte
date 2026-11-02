<script lang="ts">
import { onDestroy, tick } from "svelte";
import { apiJson } from "@/lib/adminApi";
import { clearDraft, getDraft } from "@/lib/adminDrafts";
import { type AdminEditor, createAdminEditor } from "@/lib/adminEditor";
import { registerSaveAll } from "@/lib/adminSave";
import { onMountAsync } from "@/utils/svelte-mount";

let { section = "about", apiPath = "/api/about/" } = $props();

let editor: AdminEditor | null = null;
let rawContent = $state("");
let saving = $state(false);
let message = $state("");
let loaded = $state(false);

const titles: Record<string, string> = {
	about: "关于页",
};

async function load() {
	try {
		const data = await apiJson<{ source?: string }>(apiPath);
		rawContent = data.source ?? "";
	} catch (err) {
		// 内容不存在（非 2xx）保持空白，仅网络错误提示
		if (err instanceof TypeError) message = "加载失败";
	}
	loaded = true;
	await tick();
	initEditor();
}

async function initEditor() {
	if (editor) {
		editor.setValue(rawContent);
		return;
	}

	editor = await createAdminEditor("md-editor", {
		value: rawContent,
		minHeight: "calc(100vh - 320px)",
		upload: {
			url: "/api/admin/upload-image/",
			fieldName: "file",
			headers: {},
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
		return false;
	}
	try {
		await apiJson(apiPath, {
			method: "PUT",
			headers: { "Content-Type": "text/markdown" },
			body: content,
		});
		message = "已保存";
		clearDraft("关于页");
		return true;
	} catch (err) {
		message = err instanceof Error ? err.message : "网络错误";
		return false;
	} finally {
		saving = false;
	}
}

onMountAsync(async () => {
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
onDestroy(() => {
	editor?.destroy();
	editor = null;
});
</script>

<div class="ui-page">
	<div class="ui-head">
		<div>
			<h2 class="ui-title">{titles[section] || "内容编辑"}</h2>
			<p class="ui-sub">编辑 about/index.md（frontmatter + Markdown 正文）</p>
		</div>
		<div class="ui-acts">
			{#if message}
				<span class="ui-badge">{message}</span>
			{/if}
			<button class="ui-btn ui-btn-primary" onclick={save} disabled={saving}>
				{saving ? "保存中…" : "保存"}
			</button>
		</div>
	</div>

	{#if loaded}
		<div class="ui-card">
			<div class="ui-card-b">
				<textarea id="md-editor"></textarea>
			</div>
		</div>
	{:else}
		<div class="ui-card">
			<div class="ui-empty">{message || "加载中…"}</div>
		</div>
	{/if}
</div>

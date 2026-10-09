<script lang="ts">
import { onMount } from "svelte";
import { apiJson } from "@/lib/adminApi";
import { clearDraft, getDraft } from "@/lib/adminDrafts";
import { registerSaveAll } from "@/lib/adminSave";
import { onMountAsync } from "@/utils/svelte-mount";
import AdminPageConfig from "./AdminPageConfig.svelte";

let title = $state("公告栏");
let content = $state("");
let loading = $state(true);
let saving = $state(false);
let message = $state("");
let loadError = $state("");

async function load() {
	loadError = "";
	try {
		const data = await apiJson<{
			title?: string;
			sections?: Array<{ lines?: Array<{ text?: string }> }>;
		}>("/api/notice/");
		title = data.title || "公告栏";

		if (Array.isArray(data.sections)) {
			for (const section of data.sections) {
				if (section?.lines?.length) {
					content = section.lines[0]?.text ?? "";
					break;
				}
			}
		}
	} catch (err) {
		// 加载失败必须显式告警：否则表单以空/默认值呈现，保存会覆盖真实公告
		loadError = err instanceof Error ? err.message : "网络错误";
	}
	loading = false;
}

async function save() {
	if (loadError) {
		message = "加载失败，请刷新后重试（不保存）";
		return false;
	}
	saving = true;
	message = "";
	try {
		await apiJson("/api/notice/", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				title,
				sections: [{ label: "", lines: [{ text: content }] }],
			}),
		});
		message = "已保存";
		clearDraft("公告");
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
	const d = getDraft<{ title?: string; content?: string }>("公告");
	if (d) {
		if (d.title != null) title = d.title;
		if (d.content != null) content = d.content;
		clearDraft("公告");
	}
	return registerSaveAll("公告", save, () => ({ title, content }));
});
</script>

<div class="crud-page">
	<div class="crud-head">
		<div>
			<h2>公告管理</h2>
			<p class="crud-sub">单条公告内容（标题 + 文本）</p>
		</div>
		<div class="crud-head-actions">
			{#if message}
				<span class="crud-msg">{message}</span>
			{/if}
			<button class="btn-primary" onclick={save} disabled={saving || loadError !== ""}>
				{saving ? "保存中…" : "保存"}
			</button>
		</div>
	</div>

	<AdminPageConfig
		group="announcement"
		enableKey="enabled"
		enableLabel="启用公告"
		title="公告"
		titleField="title"
	/>

	{#if loadError}
		<div class="crud-card">
			<p class="load-error">加载失败：{loadError}。已禁用保存以避免覆盖真实公告，请刷新后重试。</p>
		</div>
	{:else if !loading}
		<div class="crud-card">
			<div class="notice-form">
				<label class="crud-field">
					<span>公告标题</span>
					<input aria-label="公告标题" type="text" bind:value={title} />
				</label>
				<label class="crud-field">
					<span>公告内容</span>
					<textarea aria-label="公告内容" bind:value={content} placeholder="请输入公告内容"></textarea>
				</label>
			</div>
		</div>
	{/if}
</div>

<style>
	.load-error {
		margin: 0;
		padding: 0.5rem 0.65rem;
		border-radius: 0.5rem;
		background: rgba(220, 38, 38, 0.1);
		color: #dc2626;
		font-size: 0.85rem;
		line-height: 1.5;
	}
	.notice-form {
		display: flex;
		flex-direction: column;
		gap: 0.9rem 1rem;
	}
	.notice-form input,
	.notice-form textarea {
		padding: 0.48rem 0.65rem;
		border: 1px solid var(--line-divider);
		border-radius: 0.5rem;
		background: transparent;
		color: var(--deep-text);
		font-size: 0.88rem;
		width: 100%;
		box-sizing: border-box;
		font-family: inherit;
	}
	textarea {
		min-height: 160px;
		resize: vertical;
		line-height: 1.6;
	}
</style>
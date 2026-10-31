<script lang="ts">
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
		const status = (err as { status?: number }).status;
		if (status === 404) {
			// 尚无公告：视为空表单，保存走 upsert 创建，不能因此锁死编辑
		} else {
			// 真正的加载失败必须显式告警：否则表单以空/默认值呈现，保存会覆盖真实公告
			loadError = err instanceof Error ? err.message : "网络错误";
		}
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

<div class="ui-page">
	<div class="ui-head">
		<div>
			<h2 class="ui-title">公告管理</h2>
			<p class="ui-sub">单条公告内容（标题 + 文本）</p>
		</div>
		<div class="ui-acts">
			{#if message}
				<span class="ui-badge">{message}</span>
			{/if}
			<button class="ui-btn ui-btn-primary" onclick={save} disabled={saving || loadError !== ""}>
				{saving ? "保存中…" : "保存"}
			</button>
		</div>
	</div>

	<AdminPageConfig
		group="announcement"
		enableKey="enabled"
		enableLabel="启用公告"
		title="公告"
	/>

	{#if loadError}
		<div class="ui-card">
			<div class="ui-card-b">
				<p class="ui-sub">加载失败：{loadError}。已禁用保存以避免覆盖真实公告，请刷新后重试。</p>
			</div>
		</div>
	{:else if !loading}
		<div class="ui-card">
			<div class="ui-card-b">
				<div class="notice-form">
					<label class="ui-field">
						<span class="ui-label">公告标题</span>
						<input class="ui-input" aria-label="公告标题" type="text" bind:value={title} />
					</label>
					<label class="ui-field field-area">
						<span class="ui-label">公告内容</span>
						<textarea class="ui-input" aria-label="公告内容" bind:value={content} placeholder="请输入公告内容"></textarea>
					</label>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.notice-form {
		display: grid;
		gap: 14px;
	}
	.field-area {
		grid-template-rows: 18px auto;
	}
	.field-area textarea {
		height: auto;
		min-height: 200px;
		padding: 8px 10px;
		resize: vertical;
		line-height: 1.6;
	}
</style>

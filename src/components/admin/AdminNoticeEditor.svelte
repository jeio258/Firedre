<script lang="ts">
import { onMount } from "svelte";
import { apiJson } from "@/lib/adminApi";

let title = "公告栏";
let content = "";
let loading = true;
let saving = false;
let message = "";

async function load() {
	try {
		const data = await apiJson("/api/notice/");
		title = data.title || "公告栏";

		if (Array.isArray(data.sections)) {
			for (const section of data.sections) {
				if (section?.lines?.length) {
					content = section.lines[0]?.text ?? "";
					break;
				}
			}
		}
	} catch {
		// 忽略
	}
	loading = false;
}

async function save() {
	saving = true;
	message = "";
	try {
		const resp = await fetch("/api/notice/", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			// 只保留一个公告内容输入框：保存为单区块单行
			body: JSON.stringify({
				title,
				sections: [{ label: "", lines: [{ text: content }] }],
			}),
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
		<h2>公告管理</h2>
		<div class="actions">
			{#if message}
				<span class="msg">{message}</span>
			{/if}
			<button class="btn-primary" on:click={save} disabled={saving}>
				{saving ? "保存中…" : "保存"}
			</button>
		</div>
	</div>

	{#if !loading}
		<label class="title-field">
			<span>公告标题</span>
			<input type="text" bind:value={title} />
		</label>

		<label class="content-field">
			<span>公告内容</span>
			<textarea bind:value={content} placeholder="请输入公告内容"></textarea>
		</label>
	{/if}
</div>

<style>
	label {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		margin-bottom: 1rem;
		font-size: 0.85rem;
		color: var(--text-muted);
	}
	input,
	textarea {
		padding: 0.5rem 0.7rem;
		border: 1px solid var(--line-color);
		border-radius: 0.4rem;
		font-size: 0.9rem;
		background: var(--card-bg);
		color: var(--deep-text);
	}
	textarea {
		min-height: 160px;
		resize: vertical;
		line-height: 1.6;
	}
</style>

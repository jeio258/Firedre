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
			message = "已保存";
		} catch {
			message = "网络错误";
		} finally {
			saving = false;
		}
	}

	onMount(load);
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
			<button class="btn-primary" on:click={save} disabled={saving}>
				{saving ? "保存中…" : "保存"}
			</button>
		</div>
	</div>

	{#if !loading}
		<div class="crud-card">
			<div class="notice-form">
				<label class="crud-field">
					<span>公告标题</span>
					<input type="text" bind:value={title} />
				</label>
				<label class="crud-field">
					<span>公告内容</span>
					<textarea bind:value={content} placeholder="请输入公告内容"></textarea>
				</label>
			</div>
		</div>
	{/if}
</div>

<style>
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
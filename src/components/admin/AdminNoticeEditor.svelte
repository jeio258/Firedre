<script lang="ts">
import { onMount } from "svelte";

type NoticeSection = {
	label: string;
	lines: Array<{ text: string; url?: string }>;
};

let title = "公告栏";
let sections: NoticeSection[] = [];
let loading = true;
let saving = false;
let message = "";

async function load() {
	try {
		const resp = await fetch("/api/notice/");
		if (resp.ok) {
			const data = await resp.json();
			title = data.title || "公告栏";
			sections = Array.isArray(data.sections) ? data.sections : [];
		}
	} catch {
		// 忽略
	}
	loading = false;
}

function addSection() {
	sections = [...sections, { label: "", lines: [{ text: "" }] }];
}

function removeSection(index: number) {
	sections = sections.filter((_, i) => i !== index);
}

function addLine(index: number) {
	const next = [...sections];
	next[index] = { ...next[index], lines: [...next[index].lines, { text: "" }] };
	sections = next;
}

async function save() {
	saving = true;
	message = "";
	try {
		const resp = await fetch("/api/notice/", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ title, sections }),
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

		{#each sections as section, si}
			<div class="section">
				<div class="section-head">
					<input type="text" placeholder="区块标签（如：--- 主域名 ---）" bind:value={section.label} />
					<button class="danger" on:click={() => removeSection(si)}>删除区块</button>
				</div>
				{#each section.lines as line, li}
					<div class="line">
						<input type="text" placeholder="公告内容" bind:value={line.text} />
						<button class="danger" on:click={() => {
							const next = [...sections];
							next[si] = { ...next[si], lines: next[si].lines.filter((_, i) => i !== li) };
							sections = next;
						}}>×</button>
					</div>
				{/each}
				<button class="btn-ghost" on:click={() => addLine(si)}>+ 添加一行</button>
			</div>
		{/each}

		<button class="btn-ghost" on:click={addSection}>+ 添加区块</button>
	{/if}
</div>

<style>
	.admin-card {
		background: var(--card-bg, #fff);
		border: 1px solid var(--line-divider, #e5e7eb);
		border-radius: var(--radius-large, 0.75rem);
		padding: 1.25rem;
	}
	.toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 1rem;
	}
	h2 {
		font-size: 1.1rem;
		margin: 0;
		color: var(--deep-text, inherit);
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
	.btn-primary {
		padding: 0.5rem 0.9rem;
		background: var(--primary, #5b8cff);
		color: var(--btn-content, #fff);
		border: none;
		border-radius: 0.4rem;
		cursor: pointer;
	}
	.title-field {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		margin-bottom: 1rem;
		font-size: 0.85rem;
		color: var(--muted-text, #555);
	}
	input {
		padding: 0.5rem 0.7rem;
		border: 1px solid var(--line-color, #d1d5db);
		border-radius: 0.4rem;
		font-size: 0.9rem;
		background: var(--card-bg, #fff);
		color: var(--deep-text, inherit);
	}
	.section {
		border: 1px dashed var(--line-color, #d1d5db);
		border-radius: 0.5rem;
		padding: 0.8rem;
		margin-bottom: 0.8rem;
	}
	.section-head {
		display: flex;
		gap: 0.6rem;
		margin-bottom: 0.6rem;
	}
	.section-head input {
		flex: 1;
	}
	.line {
		display: flex;
		gap: 0.6rem;
		margin-bottom: 0.5rem;
	}
	.line input {
		flex: 1;
	}
	.danger {
		background: none;
		border: none;
		color: #dc2626;
		cursor: pointer;
		font-size: 0.85rem;
		padding: 0 0.4rem;
	}
	.btn-ghost {
		background: var(--btn-regular-bg, #f9fafb);
		border: 1px solid var(--line-divider, #e5e7eb);
		border-radius: 0.4rem;
		padding: 0.4rem 0.8rem;
		font-size: 0.85rem;
		cursor: pointer;
		color: var(--deep-text, inherit);
	}
</style>

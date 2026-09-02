<script lang="ts">
import { onMount } from "svelte";
import { apiJson } from "@/lib/adminApi";

type DynamicItem = {
	id: string;
	content: string;
	html?: string;
	published: number;
	pinned: boolean;
	location?: string;
};

let items: DynamicItem[] = [];
let loading = true;
let saving = false;
let message = "";
let error = "";

// 表单状态
let editingId = "";
let formContent = "";
let formPinned = false;
let formLocation = "";
let formPublished = 0;
let showForm = false;

async function load() {
	loading = true;
	error = "";
	try {
		const data = await apiJson<{ items?: unknown[] }>("/api/dynamics/");
		items = Array.isArray(data.items) ? (data.items as DynamicItem[]) : [];
	} catch {
		error = "网络错误";
	}
	loading = false;
}

function formatDate(ms: number): string {
	if (!ms) return "";
	return new Date(ms).toLocaleString("zh-CN", {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
	});
}

function truncate(text: string, n = 80): string {
	if (!text) return "";
	return text.length > n ? `${text.slice(0, n)}…` : text;
}

function openCreate() {
	editingId = "";
	formContent = "";
	formPinned = false;
	formLocation = "";
	formPublished = 0;
	showForm = true;
	message = "";
}

function openEdit(item: DynamicItem) {
	editingId = item.id;
	formContent = item.content;
	formPinned = item.pinned;
	formLocation = item.location || "";
	formPublished = item.published;
	showForm = true;
	message = "";
}

function cancelForm() {
	showForm = false;
	editingId = "";
	formPublished = 0;
	message = "";
}

async function submit() {
	if (!formContent.trim()) {
		message = "动态内容不能为空";
		return;
	}
	saving = true;
	message = "";
	try {
		const resp = await fetch("/api/dynamics/", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				id: editingId || undefined,
				content: formContent,

				published: formPublished || undefined,
				pinned: formPinned,
				location: formLocation || undefined,
			}),
		});
		const data = await resp.json();
		if (!resp.ok || !data.ok) {
			message = data.message || "保存失败";
			return;
		}
		message = "已保存 ✓";
		showForm = false;
		editingId = "";
		await load();
	} catch {
		message = "网络错误";
	} finally {
		saving = false;
	}
}

async function remove(item: DynamicItem) {
	if (!window.confirm(`确定删除这条动态吗？\n${truncate(item.content, 40)}`)) return;
	try {
		const resp = await fetch(`/api/dynamics/${encodeURIComponent(item.id)}/`, {
			method: "DELETE",
		});
		const data = await resp.json();
		if (!resp.ok || !data.ok) {
			message = data.message || "删除失败";
			return;
		}
		if (editingId === item.id) cancelForm();
		message = "已删除 ✓";
		await load();
	} catch {
		message = "网络错误";
	}
}

onMount(load);
</script>

<div class="admin-card">
	<div class="toolbar">
		<h2>动态管理</h2>
		<div class="actions">
			{#if message}
				<span class="msg">{message}</span>
			{/if}
			{#if !showForm}
				<button class="btn-primary" on:click={openCreate}>+ 新增动态</button>
			{/if}
		</div>
	</div>

	{#if error}
		<p class="hint">{error}</p>
	{:else if loading}
		<p class="hint">加载中…</p>
	{:else}

		{#if showForm}
			<div class="form">
				<div class="form-head">
					<h3>{editingId ? "编辑动态" : "新增动态"}</h3>
					<button class="danger" on:click={cancelForm}>取消</button>
				</div>
				<label class="field">
					<span>内容</span>
					<textarea rows="5" placeholder="输入动态内容" bind:value={formContent}></textarea>
				</label>
				<label class="field check">
					<input type="checkbox" bind:checked={formPinned} />
					<span>置顶</span>
				</label>
				<label class="field">
					<span>地点（可选）</span>
					<input type="text" placeholder="如：北京 / 上海" bind:value={formLocation} />
				</label>
				<div class="form-actions">
					<button class="btn-primary" on:click={submit} disabled={saving}>
						{saving ? "保存中…" : "保存"}
					</button>
				</div>
			</div>
		{/if}

		{#if items.length === 0}
			<p class="hint">暂无动态，点击"新增动态"创建第一条。</p>
		{:else}
			<ul class="list">
				{#each items as item}
					<li class="row">
						<div class="row-main">
							<p class="content">{truncate(item.content)}</p>
							<div class="meta">
								<span>{formatDate(item.published)}</span>
								{#if item.pinned}
									<span class="badge">置顶</span>
								{/if}
								{#if item.location}
									<span class="loc">{item.location}</span>
								{/if}
							</div>
						</div>
						<div class="row-actions">
							<button class="btn-ghost" on:click={() => openEdit(item)}>编辑</button>
							<button class="danger" on:click={() => remove(item)}>删除</button>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	{/if}
</div>

<style>
	.hint {
		color: var(--muted, #6b7280);
		font-size: 0.85rem;
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
	.danger {
		background: none;
		border: none;
		color: var(--danger, #dc2626);
		cursor: pointer;
		font-size: 0.85rem;
		padding: 0.2rem 0.4rem;
	}
	.form {
		border: 1px solid var(--line-divider, #e5e7eb);
		border-radius: 0.5rem;
		padding: 1rem;
		margin-bottom: 1.25rem;
		background: var(--btn-regular-bg, #fafbfc);
	}
	.form-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.8rem;
	}
	.form-head h3 {
		margin: 0;
		font-size: 0.95rem;
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		margin-bottom: 0.8rem;
		font-size: 0.85rem;
		color: var(--text-muted, #555);
	}
	.field.check {
		flex-direction: row;
		align-items: center;
		gap: 0.4rem;
	}
	.field textarea,
	.field input {
		padding: 0.5rem 0.7rem;
		border: 1px solid var(--line-color, #d1d5db);
		border-radius: 0.4rem;
		font-size: 0.9rem;
		font-family: inherit;
		resize: vertical;
		background: var(--card-bg, #fff);
		color: var(--deep-text, inherit);
	}
	.form-actions {
		display: flex;
		justify-content: flex-end;
	}
	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}
	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.8rem;
		border: 1px solid var(--line-divider, #e5e7eb);
		border-radius: 0.5rem;
		padding: 0.7rem 0.9rem;
	}
	.row-main {
		flex: 1;
		min-width: 0;
	}
	.content {
		margin: 0 0 0.3rem;
		font-size: 0.9rem;
		word-break: break-word;
		color: var(--deep-text, inherit);
	}
	.meta {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		font-size: 0.78rem;
		color: var(--text-muted, #9ca3af);
	}
	.badge {
		background: rgb(250 204 21 / 0.15);
		color: var(--warning, #92400e);
		border-radius: 0.3rem;
		padding: 0.05rem 0.4rem;
		font-size: 0.72rem;
	}
	.loc {
		color: var(--muted, #6b7280);
	}
	.row-actions {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		flex-shrink: 0;
	}
</style>

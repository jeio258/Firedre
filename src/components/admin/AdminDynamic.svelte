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
			message = "已保存";
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
			message = "已删除";
			await load();
		} catch {
			message = "网络错误";
		}
	}

	onMount(load);
</script>

<div class="crud-page">
	<div class="crud-head">
		<div>
			<h2>动态管理</h2>
			<p class="crud-sub">共 {items.length} 条</p>
		</div>
		<div class="crud-head-actions">
			{#if message}
				<span class="crud-msg">{message}</span>
			{/if}
			{#if !showForm}
				<button class="btn-primary" on:click={openCreate}>+ 新增动态</button>
			{/if}
		</div>
	</div>

	{#if error}
		<div class="crud-empty">{error}</div>
	{:else if loading}
		<div class="crud-empty">加载中…</div>
	{:else if showForm}
		<div class="crud-card">
			<div class="crud-form-head">
				<h3>{editingId ? "编辑动态" : "新增动态"}</h3>
				<button class="btn-text" on:click={cancelForm}>取消</button>
			</div>
			<div class="notice-form">
				<label class="crud-field">
					<span>内容</span>
					<textarea rows="5" placeholder="输入动态内容" bind:value={formContent}></textarea>
				</label>
				<label class="check-line">
					<input type="checkbox" bind:checked={formPinned} />
					<span class="check-text">置顶</span>
				</label>
				<label class="crud-field">
					<span>地点（可选）</span>
					<input type="text" placeholder="如：北京 / 上海" bind:value={formLocation} />
				</label>
			</div>
			<div class="crud-form-actions">
				<button class="btn-primary" on:click={submit} disabled={saving}>
					{saving ? "保存中…" : "保存"}
				</button>
			</div>
		</div>
	{:else if items.length === 0}
		<div class="crud-empty">暂无动态，点击「新增动态」创建第一条。</div>
	{:else}
		<div class="crud-list">
			{#each items as item}
				<div class="crud-row">
					<div class="crud-row-main">
						<p class="dyn-content">{truncate(item.content)}</p>
						<div class="dyn-meta">
							<span>{formatDate(item.published)}</span>
							{#if item.pinned}
								<span class="u-chip on">置顶</span>
							{/if}
							{#if item.location}
								<span class="dyn-loc">{item.location}</span>
							{/if}
						</div>
					</div>
					<div class="crud-row-actions">
						<button class="btn-ghost" on:click={() => openEdit(item)}>编辑</button>
						<button class="btn-danger-text" on:click={() => remove(item)}>删除</button>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.notice-form {
		display: flex;
		flex-direction: column;
		gap: 0.9rem 1rem;
	}
	@media (min-width: 640px) {
		.notice-form {
			display: grid;
			grid-template-columns: 1fr;
		}
	}
	.crud-field input,
	.crud-field textarea {
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
		min-height: 120px;
		resize: vertical;
	}
	.dyn-content {
		margin: 0 0 0.3rem;
		font-size: 0.9rem;
		word-break: break-word;
		color: var(--deep-text);
	}
	.dyn-meta {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		font-size: 0.78rem;
		color: var(--text-muted);
	}
	.u-chip.on {
		background: color-mix(in oklch, var(--warning) 18%, transparent);
		color: var(--warning);
		padding: 0.1rem 0.5rem;
		border-radius: 999px;
		font-size: 0.72rem;
		font-weight: 600;
	}
	.dyn-loc {
		color: var(--primary);
	}






	.check-line input {
		accent-color: var(--primary);
	}
</style>
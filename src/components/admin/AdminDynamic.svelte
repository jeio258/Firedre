<script lang="ts">
import { onMount } from "svelte";
import { apiJson } from "@/lib/adminApi";
import { clearDraft, getDraft } from "@/lib/adminDrafts";
import { registerSaveAll } from "@/lib/adminSave";
import { onMountAsync } from "@/utils/svelte-mount";
import AdminPageConfig from "./AdminPageConfig.svelte";
import Switch from "./Switch.svelte";

type DynamicItem = {
	id: string;
	content: string;
	html?: string;
	published: number;
	pinned: boolean;
	location?: string;
};

let items = $state<DynamicItem[]>([]);
let loading = $state(true);
let saving = $state(false);
let message = $state("");
let error = $state("");

let editingId = $state("");
let formContent = $state("");
let formPinned = $state(false);
let formLocation = $state("");
let formPublished = $state(0);
let showForm = $state(false);

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
		return false;
	}
	saving = true;
	message = "";
	try {
		await apiJson("/api/dynamics/", {
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
		message = "已保存";
		clearDraft("动态");
		showForm = false;
		editingId = "";
		await load();
		return true;
	} catch (err) {
		message = err instanceof Error ? err.message : "网络错误";
	} finally {
		saving = false;
	}
}

async function remove(item: DynamicItem) {
	if (!window.confirm(`确定删除这条动态吗？\n${truncate(item.content, 40)}`))
		return;
	try {
		await apiJson(`/api/dynamics/${encodeURIComponent(item.id)}/`, {
			method: "DELETE",
		});
		if (editingId === item.id) cancelForm();
		message = "已删除";
		await load();
	} catch (err) {
		message = err instanceof Error ? err.message : "网络错误";
	}
}

onMountAsync(async () => {
	await load();
	const d = getDraft<{
		showForm?: boolean;
		editingId?: string;
		formContent?: string;
		formPinned?: boolean;
		formLocation?: string;
		formPublished?: number;
	}>("动态");
	if (d) {
		showForm = d.showForm ?? false;
		editingId = d.editingId ?? "";
		formContent = d.formContent ?? "";
		formPinned = d.formPinned ?? false;
		formLocation = d.formLocation ?? "";
		formPublished = d.formPublished ?? 0;
		clearDraft("动态");
	}
	return registerSaveAll(
		"动态",
		() => (showForm ? submit() : true),
		() => ({
			showForm,
			editingId,
			formContent,
			formPinned,
			formLocation,
			formPublished,
		}),
	);
});
</script>

<div class="ui-page">
	<div class="ui-head">
		<div>
			<h2 class="ui-title">动态管理</h2>
			<p class="ui-sub">共 {items.length} 条</p>
		</div>
		<div class="ui-acts">
			{#if message}
				<span class="ui-sub">{message}</span>
			{/if}
			{#if !showForm}
				<button class="ui-btn ui-btn-primary" onclick={openCreate}>+ 新增动态</button>
			{/if}
		</div>
	</div>

	<AdminPageConfig
		group="dynamic"
		enableKey="enabled"
		enableLabel="启用动态页"
		title="动态"
		titleField="title"
		descField="description"
	/>

	{#if error}
		<div class="ui-card">
			<div class="ui-empty">{error}</div>
		</div>
	{:else if loading}
		<div class="ui-card">
			<div class="ui-empty">加载中…</div>
		</div>
	{:else if showForm}
		<div class="ui-card">
			<div class="ui-card-h">
				{editingId ? "编辑动态" : "新增动态"}
				<div class="ui-acts">
					<button class="ui-btn ui-btn-ghost ui-btn-sm" onclick={cancelForm}>取消</button>
				</div>
			</div>
			<div class="ui-card-b">
				<div class="ui-grid">
					<label class="ui-field field-wide">
						<span class="ui-label">内容</span>
						<textarea class="ui-input" rows="5" placeholder="输入动态内容" bind:value={formContent}></textarea>
					</label>
					<label class="ui-field">
						<span class="ui-label">地点（可选）</span>
						<input class="ui-input" type="text" placeholder="如：北京 / 上海" bind:value={formLocation} />
					</label>
					<div class="ui-field">
						<span class="ui-label">置顶</span>
						<div class="switch-row">
							<Switch on={formPinned} label="置顶开关" toggle={() => (formPinned = !formPinned)} />
						</div>
					</div>
				</div>
				<div class="form-acts">
					<button class="ui-btn ui-btn-primary" onclick={submit} disabled={saving}>
						{saving ? "保存中…" : "保存"}
					</button>
				</div>
			</div>
		</div>
	{:else}
		<div class="ui-card">
			<div class="ui-card-h">时间线</div>
			{#if items.length === 0}
				<div class="ui-empty">暂无动态，点击「新增动态」创建第一条。</div>
			{:else}
				{#each items as item}
					<div class="ui-card-b tl-item">
						<div class="tl-main">
							<p class="tl-text">{truncate(item.content)}</p>
							<div class="tl-meta ui-sub">
								<span>{formatDate(item.published)}</span>
								{#if item.pinned}
									<span class="ui-badge ui-badge-warn">置顶</span>
								{/if}
								{#if item.location}
									<span>{item.location}</span>
								{/if}
							</div>
						</div>
						<div class="tl-acts">
							<button class="ui-btn ui-btn-sm" onclick={() => openEdit(item)}>编辑</button>
							<button class="ui-btn ui-btn-sm ui-btn-ghost" onclick={() => remove(item)}>删除</button>
						</div>
					</div>
				{/each}
			{/if}
		</div>
	{/if}
</div>

<style>
	.field-wide {
		grid-column: 1 / -1;
		grid-template-rows: 18px auto;
	}
	textarea.ui-input {
		height: auto;
		min-height: 120px;
		padding: 8px 10px;
		line-height: 1.5;
		resize: vertical;
	}
	.switch-row {
		display: flex;
		align-items: center;
	}
	.form-acts {
		display: flex;
		justify-content: flex-end;
		margin-top: 14px;
	}
	.tl-item {
		display: flex;
		align-items: center;
		gap: 16px;
	}
	.tl-main {
		flex: 1;
		min-width: 0;
	}
	.tl-text {
		margin: 0 0 4px;
		word-break: break-word;
	}
	.tl-meta {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.tl-acts {
		display: flex;
		gap: 6px;
		flex-shrink: 0;
	}
</style>

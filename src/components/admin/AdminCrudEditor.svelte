<script lang="ts">
import { onMount, type Snippet } from "svelte";
import { apiJson } from "@/lib/adminApi";
import { clearDraft, getDraft } from "@/lib/adminDrafts";
import { registerSaveAll } from "@/lib/adminSave";
import { onMountAsync } from "@/utils/svelte-mount";
import Switch from "./Switch.svelte";

export type CrudFieldType = "text" | "number" | "checkbox" | "select";

export interface CrudField {
	key: string;
	label: string;
	type: CrudFieldType;
	placeholder?: string;
	options?: { value: string; label: string }[];
	required?: boolean;

	toPayload?: (v: string | number | boolean) => unknown;
}

interface Props {
	apiPath: string;
	title: string;
	addLabel: string;
	entityName: string;
	fields: CrudField[];
	identify: (item: Record<string, unknown>) => string;
	extraBlock?: Snippet;
	configBlock?: Snippet;
	children: Snippet<
		[
			{
				item: Record<string, unknown>;
				onEdit: () => void;
				onRemove: () => void;
			},
		]
	>;
}

let {
	apiPath,
	title,
	addLabel,
	entityName,
	fields,
	identify,
	extraBlock,
	configBlock,
	children,
}: Props = $props();

type Item = Record<string, unknown>;

let items: Item[] = $state([]);
let loading = $state(true);
let saving = $state(false);
let message = $state("");
let error = $state("");
let showForm = $state(false);
let editingId: number | null = $state(null);
let formValues: Record<string, string | number | boolean> = $state({});

function defaultValues(): Record<string, string | number | boolean> {
	const v: Record<string, string | number | boolean> = {};
	for (const f of fields) {
		if (f.type === "number") v[f.key] = 0;
		else if (f.type === "checkbox") v[f.key] = true;
		else if (f.type === "select") v[f.key] = f.options?.[0]?.value ?? "";
		else v[f.key] = "";
	}
	return v;
}

async function load() {
	loading = true;
	error = "";
	try {
		const data = await apiJson<{ items?: unknown[] }>(apiPath);
		items = Array.isArray(data.items) ? (data.items as Item[]) : [];
	} catch {
		error = "网络错误";
	}
	loading = false;
}

function openCreate() {
	editingId = null;
	formValues = defaultValues();
	showForm = true;
	message = "";
}

function openEdit(item: Item) {
	editingId = item.id as number;
	formValues = defaultValues();
	for (const f of fields) {
		const raw = item[f.key];
		if (typeof raw === "boolean" || typeof raw === "number")
			formValues[f.key] = raw;
		else if (raw != null) formValues[f.key] = String(raw);
	}
	showForm = true;
	message = "";
}

function cancelForm() {
	showForm = false;
	editingId = null;
	message = "";
}

async function submit() {
	for (const f of fields) {
		if (f.required) {
			const v = formValues[f.key];
			if (v === undefined || v === null || String(v).trim() === "") {
				message = `${f.label.replace(/\s*\*$/, "")}不能为空`;
				return false;
			}
		}
	}
	saving = true;
	message = "";
	try {
		const payload: Record<string, unknown> = {};
		for (const f of fields) {
			const v = formValues[f.key];
			payload[f.key] = f.toPayload ? f.toPayload(v) : v;
		}
		const url = editingId ? `${apiPath}${editingId}/` : apiPath;
		await apiJson(url, {
			method: editingId ? "PUT" : "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
		});
		message = "已保存";
		clearDraft("友链");
		showForm = false;
		editingId = null;
		await load();
		return true;
	} catch (err) {
		message = err instanceof Error ? err.message : "网络错误";
		return false;
	} finally {
		saving = false;
	}
}

async function remove(item: Item) {
	if (!window.confirm(`确定删除${entityName}「${identify(item)}」吗？`)) return;
	try {
		await apiJson(`${apiPath}${item.id}/`, { method: "DELETE" });
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
		editingId?: number | null;
		formValues?: Record<string, string | number | boolean>;
	}>("友链");
	if (d) {
		showForm = d.showForm ?? false;
		editingId = d.editingId ?? null;
		if (d.formValues) formValues = d.formValues;
		clearDraft("友链");
	}
	return registerSaveAll(
		"友链",
		() => (showForm ? submit() : true),
		() => ({ showForm, editingId, formValues }),
	);
});
</script>

<div class="ui-page">
	<div class="ui-head">
		<div>
			<h2 class="ui-title">{title}</h2>
			<p class="ui-sub">共 {items.length} 条</p>
		</div>
		<div class="ui-acts">
			{#if message}
				<span class="ui-badge">{message}</span>
			{/if}
			{#if !showForm}
				<button class="ui-btn ui-btn-primary" onclick={openCreate}>{addLabel}</button>
			{/if}
		</div>
	</div>

	{#if configBlock}
		{@render configBlock()}
	{/if}

	{#if extraBlock}
		<div class="extra">
			{@render extraBlock()}
		</div>
	{/if}

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
				{editingId ? `编辑${entityName}` : `添加${entityName}`}
				<span class="head-end">
					<button class="ui-btn ui-btn-sm ui-btn-ghost" onclick={cancelForm}>取消</button>
				</span>
			</div>
			<div class="ui-card-b">
				<div class="ui-grid">
					{#each fields as f}
						{#if f.type === "checkbox"}
							<div class="ui-field">
								<span class="ui-label">{f.label}</span>
								<div class="check-line">
									<Switch
										on={Boolean(formValues[f.key])}
										label={f.label}
										toggle={() => (formValues[f.key] = !Boolean(formValues[f.key]))}
									/>
								</div>
							</div>
						{:else}
							<label class="ui-field">
								<span class="ui-label">{f.label}</span>
								{#if f.type === "select"}
									<select class="ui-select" aria-label={f.label} bind:value={formValues[f.key]}>
										{#each f.options ?? [] as opt}
											<option value={opt.value}>{opt.label}</option>
										{/each}
									</select>
								{:else if f.type === "number"}
									<input
										class="ui-input"
										type="number"
										min="0"
										aria-label={f.label}
										bind:value={formValues[f.key]}
									/>
								{:else}
									<input
										class="ui-input"
										type="text"
										aria-label={f.label}
										placeholder={f.placeholder}
										bind:value={formValues[f.key]}
									/>
								{/if}
							</label>
						{/if}
					{/each}
				</div>
				<div class="form-acts">
					<button class="ui-btn ui-btn-primary" onclick={submit} disabled={saving}>
						{saving ? "保存中…" : "保存"}
					</button>
				</div>
			</div>
		</div>
	{:else if items.length === 0}
		<div class="ui-card">
			<div class="ui-empty">暂无{entityName}，点击「{addLabel}」创建第一条。</div>
		</div>
	{:else}
		<div class="ui-card">
			<div class="table-scroll">
				<table class="ui-table">
					<thead>
						<tr>
							<th>内容</th>
							<th class="col-acts">操作</th>
						</tr>
					</thead>
					<tbody>
						{#each items as item}
							<tr>
								<td>
									{@render children({ item, onEdit: () => openEdit(item), onRemove: () => remove(item) })}
								</td>
								<td class="col-acts">
									<div class="row-acts">
										<button class="ui-btn ui-btn-sm ui-btn-ghost" onclick={() => openEdit(item)}>
											编辑
										</button>
										<button class="ui-btn ui-btn-sm ui-btn-ghost" onclick={() => remove(item)}>
											删除
										</button>
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}
</div>

<style>
	.extra {
		display: contents;
	}
	.table-scroll {
		overflow-x: auto;
	}
	.col-acts {
		width: 1%;
		white-space: nowrap;
	}
	.row-acts,
	.head-end {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.head-end {
		margin-left: auto;
	}
	.check-line {
		display: flex;
		align-items: center;
		height: 36px;
	}
	.form-acts {
		display: flex;
		justify-content: flex-end;
		margin-top: 14px;
	}
</style>

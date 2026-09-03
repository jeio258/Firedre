<script lang="ts">
	import { onMount } from "svelte";
	import { apiJson } from "@/lib/adminApi";
	import { type Snippet } from "svelte";

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
		children: Snippet;
	}

	let {
		apiPath,
		title,
		addLabel,
		entityName,
		fields,
		identify,
		extraBlock,
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
			if (typeof raw === "boolean" || typeof raw === "number") formValues[f.key] = raw;
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
					return;
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
			const resp = await fetch(url, {
				method: editingId ? "PUT" : "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});
			const data = await resp.json();
			if (!resp.ok || !data.ok) {
				message = data.message || "保存失败";
				return;
			}
			message = "已保存";
			showForm = false;
			editingId = null;
			await load();
		} catch {
			message = "网络错误";
		} finally {
			saving = false;
		}
	}

	async function remove(item: Item) {
		if (!window.confirm(`确定删除${entityName}「${identify(item)}」吗？`)) return;
		try {
			const resp = await fetch(`${apiPath}${item.id}/`, { method: "DELETE" });
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
			<h2>{title}</h2>
			<p class="crud-sub">共 {items.length} 条</p>
		</div>
		<div class="crud-head-actions">
			{#if message}
				<span class="crud-msg">{message}</span>
			{/if}
			{#if !showForm}
				<button class="btn-primary" on:click={openCreate}>{addLabel}</button>
			{/if}
		</div>
	</div>

	{#if extraBlock}
		<div class="crud-extra">
			{@render extraBlock()}
		</div>
	{/if}

	{#if error}
		<div class="crud-empty">{error}</div>
	{:else if loading}
		<div class="crud-empty">加载中…</div>
	{:else if showForm}
		<div class="crud-card">
			<div class="crud-form-head">
				<h3>{editingId ? `编辑${entityName}` : `添加${entityName}`}</h3>
				<button class="btn-text" on:click={cancelForm}>取消</button>
			</div>
			<div class="crud-form">
				{#each fields as f}
					<label class="crud-field">
						{#if f.type !== "checkbox"}
							<span>{f.label}</span>
						{/if}
						{#if f.type === "checkbox"}
							<div class="check-line">
								<input type="checkbox" bind:checked={formValues[f.key]} />
								<span class="check-text">{f.label}</span>
							</div>
						{:else if f.type === "select"}
							<select bind:value={formValues[f.key]}>
								{#each f.options ?? [] as opt}
									<option value={opt.value}>{opt.label}</option>
								{/each}
							</select>
						{:else if f.type === "number"}
							<input type="number" min="0" bind:value={formValues[f.key]} />
						{:else}
							<input type="text" placeholder={f.placeholder} bind:value={formValues[f.key]} />
						{/if}
					</label>
				{/each}
			</div>
			<div class="crud-form-actions">
				<button class="btn-primary" on:click={submit} disabled={saving}>
					{saving ? "保存中…" : "保存"}
				</button>
			</div>
		</div>
	{:else if items.length === 0}
		<div class="crud-empty">
			暂无{entityName}，点击「{addLabel}」创建第一条。
		</div>
	{:else}
		<div class="crud-list">
			{#each items as item}
				<div class="crud-row">
					<div class="crud-row-main">
						{@render children({ item, onEdit: () => openEdit(item), onRemove: () => remove(item) })}
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

	.crud-head h2 {
		margin: 0;
		font-size: 1.12rem;
		font-weight: 700;
		color: var(--deep-text);
	}










	.crud-extra {
		display: contents;
	}


	.crud-form-head h3 {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 600;
		color: var(--deep-text);
	}


	.crud-field input,
	.crud-field select {
		padding: 0.48rem 0.65rem;
		border: 1px solid var(--line-divider);
		border-radius: 0.5rem;
		background: transparent;
		color: var(--deep-text);
		font-size: 0.88rem;
		width: 100%;
		box-sizing: border-box;
	}

	.check-line input {
		width: auto;
		accent-color: var(--primary);
	}








	</style>

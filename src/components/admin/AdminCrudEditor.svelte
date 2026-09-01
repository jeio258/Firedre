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
			message = "已保存 ✓";
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
		<h2>{title}</h2>
		<div class="actions">
			{#if message}
				<span class="msg">{message}</span>
			{/if}
			{#if !showForm}
				<button class="btn-primary" on:click={openCreate}>{addLabel}</button>
			{/if}
		</div>
	</div>

	{#if extraBlock}
		{@render extraBlock()}
	{/if}

	{#if error}
		<p class="hint">{error}</p>
	{:else if loading}
		<p class="hint">加载中…</p>
	{:else if showForm}
		<div class="form">
			<div class="form-head">
				<h3>{editingId ? `编辑${entityName}` : `添加${entityName}`}</h3>
				<button class="danger" on:click={cancelForm}>取消</button>
			</div>
			{#each fields as f}
				{#if f.type === "checkbox"}
					<label class="field check">
						<input type="checkbox" bind:checked={formValues[f.key]} />
						<span>{f.label}</span>
					</label>
				{:else if f.type === "select"}
					<label class="field">
						<span>{f.label}</span>
						<select bind:value={formValues[f.key]}>
							{#each f.options ?? [] as opt}
								<option value={opt.value}>{opt.label}</option>
							{/each}
						</select>
					</label>
				{:else if f.type === "number"}
					<label class="field">
						<span>{f.label}</span>
						<input type="number" min="0" bind:value={formValues[f.key]} />
					</label>
				{:else}
					<label class="field">
						<span>{f.label}</span>
						<input type="text" placeholder={f.placeholder} bind:value={formValues[f.key]} />
					</label>
				{/if}
			{/each}
			<div class="form-actions">
				<button class="btn-primary" on:click={submit} disabled={saving}>
					{saving ? "保存中…" : "保存"}
				</button>
			</div>
		</div>
	{:else if items.length === 0}
		<p class="hint">暂无{entityName}，点击"{addLabel}"创建第一条。</p>
	{:else}
		<ul class="list">
			{#each items as item}
				<li class="row">
					<div class="row-main">
						{@render children({ item, onEdit: () => openEdit(item), onRemove: () => remove(item) })}
					</div>
					<div class="row-actions">
						<button class="btn-ghost" on:click={() => openEdit(item)}>编辑</button>
						<button class="danger" on:click={() => remove(item)}>删除</button>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</div>

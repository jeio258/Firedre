<script lang="ts">
import { apiJson } from "@/lib/adminApi";
import { clearDraft, getDraft } from "@/lib/adminDrafts";
import { registerSaveAll } from "@/lib/adminSave";
import { onMountAsync } from "@/utils/svelte-mount";
import Switch from "./Switch.svelte";

type Location = "navbar" | "footer" | "profile" | "sponsor";

type SiteLinkItem = {
	id: number;
	name: string;
	url: string;
	icon: string;
	location: Location;
	kind?: "link" | "qr";
	enabled: boolean;
	sortOrder?: number;
};

type FormField = {
	key: string;
	label: string;
	type: "text" | "number" | "checkbox" | "select";
	placeholder?: string;
	options?: { value: string; label: string }[];
	required?: boolean;
	toPayload?: (v: string | number | boolean) => unknown;
};

const API_PATH = "/api/site-links/";

const LOCATION_LABELS: Record<Location, string> = {
	navbar: "导航栏「链接」下拉",
	footer: "页脚 Powered by",
	profile: "侧栏资料卡",
	sponsor: "打赏方式（二维码/跳转）",
};

const LOCATION_ORDER = Object.keys(LOCATION_LABELS) as Location[];

const fields: FormField[] = [
	{
		key: "name",
		label: "名称 *",
		type: "text",
		placeholder: "如：GitHub",
		required: true,
	},
	{
		key: "url",
		label: "链接地址 *",
		type: "text",
		placeholder: "https://github.com/you",
		required: true,
	},
	{
		key: "icon",
		label: "图标（Iconify 名称，可选）",
		type: "text",
		placeholder: "fa7-brands:github",
	},
	{
		key: "location",
		label: "展示位置 *",
		type: "select",
		options: LOCATION_ORDER.map((v) => ({
			value: v,
			label: LOCATION_LABELS[v],
		})),
		required: true,
	},
	{
		key: "kind",
		label: "类型（打赏方式时用）",
		type: "select",
		options: [
			{ value: "link", label: "跳转链接（外链/前往打赏）" },
			{ value: "qr", label: "二维码图片（收款码）" },
		],
	},
	{
		key: "sortOrder",
		label: "排序（同位置从小到大）",
		type: "number",
		toPayload: (v) => Number(v) || 0,
	},
	{ key: "enabled", label: "启用（显示在前台对应位置）", type: "checkbox" },
];

let items = $state<SiteLinkItem[]>([]);
let loading = $state(true);
let saving = $state(false);
let message = $state("");
let error = $state("");
let showForm = $state(false);
let editingId: number | null = $state(null);
let formValues: Record<string, string | number | boolean> = $state({});

let siteUrl = $state("");
let siteUrlSaving = $state(false);
let siteUrlMsg = $state("");

function kindLabel(item: SiteLinkItem): string {
	if (item.location === "sponsor")
		return item.kind === "qr" ? "二维码" : "跳转链接";
	return "链接";
}

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
		const data = await apiJson<{ items?: unknown[] }>(API_PATH);
		items = Array.isArray(data.items) ? (data.items as SiteLinkItem[]) : [];
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

function openEdit(item: SiteLinkItem) {
	editingId = item.id;
	formValues = defaultValues();
	for (const f of fields) {
		const raw = (item as unknown as Record<string, unknown>)[f.key];
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
		const url = editingId ? `${API_PATH}${editingId}/` : API_PATH;
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

async function remove(item: SiteLinkItem) {
	if (!window.confirm(`确定删除链接「${item.name}」吗？`)) return;
	try {
		await apiJson(`${API_PATH}${item.id}/`, { method: "DELETE" });
		if (editingId === item.id) cancelForm();
		message = "已删除";
		await load();
	} catch (err) {
		message = err instanceof Error ? err.message : "网络错误";
	}
}

async function loadSiteUrl() {
	try {
		const settings = await apiJson<Record<string, unknown>>(
			"/api/settings/?group=basic",
		);
		siteUrl = String((settings as { siteUrl?: unknown }).siteUrl ?? "");
	} catch {
		// 域名加载失败不影响链接列表
	}
}

async function saveSiteUrl() {
	const val = siteUrl.trim();
	if (!val) {
		siteUrlMsg = "域名不能为空";
		return false;
	}
	siteUrlSaving = true;
	siteUrlMsg = "";
	try {
		await apiJson("/api/settings/", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ groups: { basic: { siteUrl: val } } }),
		});
		siteUrlMsg = "域名已保存 ✓";
		clearDraft("站点链接");
		return true;
	} catch (err) {
		siteUrlMsg = err instanceof Error ? err.message : "网络错误";
		return false;
	} finally {
		siteUrlSaving = false;
	}
}

onMountAsync(async () => {
	await load();
	await loadSiteUrl();

	const dLinks = getDraft<{
		showForm?: boolean;
		editingId?: number | null;
		formValues?: Record<string, string | number | boolean>;
	}>("友链");
	if (dLinks) {
		showForm = dLinks.showForm ?? false;
		editingId = dLinks.editingId ?? null;
		if (dLinks.formValues) formValues = dLinks.formValues;
		clearDraft("友链");
	}

	const dDomain = getDraft<{ siteUrl?: string }>("站点链接");
	if (dDomain?.siteUrl != null) {
		siteUrl = dDomain.siteUrl;
		clearDraft("站点链接");
	}

	const unregisterLinks = registerSaveAll(
		"友链",
		() => (showForm ? submit() : true),
		() => ({ showForm, editingId, formValues }),
	);
	const unregisterDomain = registerSaveAll("站点链接", saveSiteUrl, () => ({
		siteUrl,
	}));

	return () => {
		unregisterLinks();
		unregisterDomain();
	};
});
</script>

<div class="ui-page">
	<div class="ui-head">
		<div>
			<h2 class="ui-title">链接管理</h2>
			<p class="ui-sub">共 {items.length} 条</p>
		</div>
		<div class="ui-acts">
			{#if message}
				<span class="ui-badge">{message}</span>
			{/if}
			{#if !showForm}
				<button class="ui-btn ui-btn-primary" onclick={openCreate}>+ 添加链接</button>
			{/if}
		</div>
	</div>

	<div class="ui-card">
		<div class="ui-card-h">
			站点主域名
			{#if siteUrlMsg}
				<span class="ui-sub">{siteUrlMsg}</span>
			{/if}
		</div>
		<div class="ui-card-b">
			<div class="url-row">
				<label class="ui-field">
					<span class="ui-label">站点链接 URL</span>
					<input
						class="ui-input"
						type="text"
						aria-label="站点链接 URL"
						placeholder="https://example.com"
						bind:value={siteUrl}
					/>
				</label>
				<button class="ui-btn" onclick={saveSiteUrl} disabled={siteUrlSaving}>
					{siteUrlSaving ? "保存中…" : "保存域名"}
				</button>
			</div>
		</div>
	</div>

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
				{editingId ? "编辑链接" : "添加链接"}
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
			<div class="ui-empty">暂无链接，点击「+ 添加链接」创建第一条。</div>
		</div>
	{:else}
		{#each LOCATION_ORDER as loc}
			{@const groupItems = items.filter((item) => item.location === loc)}
			{#if groupItems.length}
				<div class="ui-card">
					<div class="ui-card-h">
						{LOCATION_LABELS[loc]}
						<span class="ui-sub">{groupItems.length} 条</span>
					</div>
					<div class="table-scroll">
						<table class="ui-table">
							<thead>
								<tr>
									<th>名称</th>
									<th>地址</th>
									<th>类型</th>
									<th>操作</th>
								</tr>
							</thead>
							<tbody>
								{#each groupItems as item (item.id)}
									<tr>
										<td>
											{item.name}
											{#if !item.enabled}
												<span class="ui-badge">未启用</span>
											{/if}
										</td>
										<td class="url-cell">{item.url}</td>
										<td>{kindLabel(item)}</td>
										<td>
											<div class="row-acts">
												<button class="ui-btn ui-btn-sm" onclick={() => openEdit(item)}>
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
		{/each}
	{/if}
</div>

<style>
	.url-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 8px;
		align-items: end;
	}
	.form-acts {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		margin-top: 14px;
	}
	.check-line {
		display: flex;
		align-items: center;
		height: 36px;
	}
	.head-end,
	.row-acts {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.head-end {
		margin-left: auto;
	}
	.table-scroll {
		overflow-x: auto;
	}
	.url-cell {
		max-width: 460px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>

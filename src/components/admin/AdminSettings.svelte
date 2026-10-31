<script lang="ts">
import { settingsDefaults as defaultsJson } from "@shared/config/settings-defaults";
import { apiJson } from "@/lib/adminApi";
import { clearDraft, getDraft } from "@/lib/adminDrafts";
import { registerSaveAll } from "@/lib/adminSave";
import { onMountAsync } from "@/utils/svelte-mount";
import {
	CATEGORIES,
	type Field,
	GROUPS,
	type Group,
} from "./adminSettingsSchema";
import JsonEditor from "./JsonEditor.svelte";
import RecordsEditor from "./RecordsEditor.svelte";
import Switch from "./Switch.svelte";

let data = $state<Record<string, Record<string, unknown>>>({});
let loading = $state(true);
let loadError = $state("");
let saving = $state(false);
let message = $state("");
let loaded = $state(false);

let { cat = 0 }: { cat?: number } = $props();
const baseCat = $derived(typeof cat === "number" ? cat : 0);
// 顶部条点击后在本地接管分类；外部 cat 变化时旧接管自动失效（不额外跑 effect）
let picked = $state<{ base: number; idx: number } | null>(null);
const activeIdx = $derived(picked?.base === baseCat ? picked.idx : baseCat);
const activeCat = $derived(CATEGORIES[activeIdx] ?? CATEGORIES[0]);
const groups = $derived(GROUPS.filter((g) => g.category === activeCat));
// 当前选中的评论类型（独立响应式变量，供显隐逻辑直接引用）
let cmtTypeVal = $state("");

async function load() {
	try {
		const all = (await apiJson("/api/settings/")) as Record<
			string,
			Record<string, unknown>
		>;
		const defaults = defaultsJson as unknown as Record<
			string,
			Record<string, unknown>
		>;
		for (const g of GROUPS) {
			const saved = all[g.key] ?? {};
			const def = defaults[g.key] ?? {};
			const merged: Record<string, unknown> = {};
			for (const f of g.fields) {
				const v = saved[f.name];
				merged[f.name] = v !== undefined ? v : def[f.name];
			}
			data[g.key] = merged;
		}
		data.nav = { ...(defaults.nav ?? {}), ...(all.nav ?? {}) };
		cmtTypeVal = String(data.comment?.type ?? "");
	} catch {
		loadError = "设置加载失败，请刷新重试";
	}
	loading = false;
	loaded = true;
}

function cycleBool(key: string, field: string) {
	data[key][field] = !data[key][field];
	markDirty();
}

function markDirty() {
	if (!loaded) return;
	message = "有未保存的修改，请点击「保存全部」";
}

// 字段是否可见：带 cmt 标签的字段仅在该评论类型选中时显示
function isFieldVisible(field: Field, t: string = cmtTypeVal): boolean {
	if (field.hidden) return false;
	if (field.cmt) return field.cmt === t;
	return true;
}

type BlockKind = "basic" | "text" | "struct" | "switch" | "page";

const BLOCKS: { kind: BlockKind; title: string }[] = [
	{ kind: "basic", title: "基本选项" },
	{ kind: "text", title: "长文本" },
	{ kind: "struct", title: "结构化数据" },
	{ kind: "switch", title: "开关" },
	{ kind: "page", title: "页面开关" },
];

// 页面开关按存储键前缀识别（pageWidth 是数字项，不在此列）
const PAGE_KEY = /^page[A-Z]/;

function blockOf(field: Field): BlockKind {
	if (field.type === "boolean")
		return PAGE_KEY.test(field.name) ? "page" : "switch";
	if (field.type === "textarea") return "text";
	if (field.type === "json" || field.type === "records") return "struct";
	return "basic";
}

// 6 列栅格：常规项占 2 列（一行 3 个）。余 2 项 → 末两项各占 3 列；
// 余 1 项 → 末四项各占 3 列（两行 × 两个）；单件独占整行以消除空档。
function spanClass(n: number): string {
	const rem = n % 3;
	if (rem === 1) return n === 1 ? "solo" : "rem1";
	if (rem === 2) return "rem2";
	return "";
}

function blocksOf(group: Group) {
	const visible = group.fields.filter((f) => isFieldVisible(f, cmtTypeVal));
	return BLOCKS.map((b) => {
		const fields = visible.filter((f) => blockOf(f) === b.kind);
		return { ...b, fields, span: spanClass(fields.length) };
	}).filter((b) => b.fields.length > 0);
}

const jsonFields = new Set(
	GROUPS.flatMap((g) =>
		g.fields
			.filter((f) => f.type === "json" || f.type === "records")
			.map((f) => f.name),
	),
);

async function save() {
	saving = true;
	message = "";
	try {
		const out: Record<string, Record<string, unknown>> = {};

		for (const g of GROUPS) {
			const payload = { ...(data[g.key] ?? {}) };
			for (const k of Object.keys(payload)) {
				const v = payload[k];
				if (jsonFields.has(k)) {
					if (v === "" || v == null) delete payload[k];
				} else if (v == null) {
					delete payload[k];
				}
			}
			out[g.key] = payload;
		}
		out.nav = { ...(data.nav ?? {}) };
		try {
			await apiJson("/api/settings/", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ groups: out }),
			});
		} catch (err) {
			if (err instanceof TypeError) throw err;
			message = `保存失败：${err instanceof Error ? err.message : ""}`;
			return false;
		}
		message = `已保存 ✓ ${new Date().toLocaleTimeString()}`;
		clearDraft("站点设置");

		applyHueToAdmin(data.basic?.hue);
		return true;
	} catch {
		message = "网络错误，修改尚未保存";
		return false;
	} finally {
		saving = false;
	}
}

function applyHueToAdmin(hue: unknown) {
	if (typeof document === "undefined") return;

	if (hue == null || hue === "") return;
	const h = Number(hue);
	if (!Number.isFinite(h) || h < 0 || h > 360) return;
	document.documentElement.style.setProperty("--hue", String(h));
	document.body.style.background = getComputedStyle(document.documentElement)
		.getPropertyValue("--page-bg")
		.trim();
}

// 暴露给顶栏「保存全部」
onMountAsync(async () => {
	await load();
	const d = getDraft<Record<string, Record<string, unknown>>>("站点设置");
	if (d) {
		data = d;
		clearDraft("站点设置");
	}
	return registerSaveAll("站点设置", save, () => data);
});
</script>

{#snippet control(group: Group, field: Field)}
	{#if field.type === "select"}
		<select
			aria-label={field.label}
			value={(data[group.key]?.[field.name] as string) ?? ""}
			onchange={(e) => {
				const v = e.currentTarget.value;
				data[group.key][field.name] = v;
				cmtTypeVal = v;
				markDirty();
			}}
		>
			{#each field.options ?? [] as opt}
				<option value={opt.value}>{opt.label}</option>
			{/each}
		</select>
	{:else if field.type === "textarea"}
		<textarea
			aria-label={field.label}
			rows="3"
			value={(data[group.key]?.[field.name] as string) ?? ""}
			placeholder={field.placeholder}
			oninput={(e) => {
				data[group.key][field.name] = e.currentTarget.value;
				markDirty();
			}}
		></textarea>
	{:else if field.type === "json"}
		<JsonEditor
			value={data[group.key]?.[field.name]}
			placeholder={field.placeholder ?? ""}
			fieldLabel={field.label}
			onChange={(v) => {
				data[group.key][field.name] = v;
				markDirty();
			}}
		/>
	{:else if field.type === "records"}
		<RecordsEditor
			value={data[group.key]?.[field.name]}
			recordFields={field.recordFields ?? []}
			objectFields={field.objectFields ?? []}
			groupFields={field.groupFields ?? []}
			itemFields={field.itemFields ?? []}
			indent={field.indent ?? "  "}
			separator={field.separator ?? " "}
			fieldLabel={field.label}
			placeholder={field.placeholder ?? ""}
			onChange={(v) => {
				data[group.key][field.name] = v;
				markDirty();
			}}
		/>
	{:else if field.type === "password"}
		<input
			aria-label={field.label}
			type="password"
			value={(data[group.key]?.[field.name] as string) ?? ""}
			placeholder={field.placeholder}
			autocomplete="off"
			oninput={(e) => {
				data[group.key][field.name] = e.currentTarget.value;
				markDirty();
			}}
		/>
	{:else if field.type === "number"}
		<input
			aria-label={field.label}
			type="number"
			value={(data[group.key]?.[field.name] as number) ?? ""}
			oninput={(e) => {
				data[group.key][field.name] = e.currentTarget.valueAsNumber;
				markDirty();
			}}
		/>
	{:else}
		<input
			aria-label={field.label}
			type="text"
			value={(data[group.key]?.[field.name] as string) ?? ""}
			placeholder={field.placeholder}
			oninput={(e) => {
				data[group.key][field.name] = e.currentTarget.value;
				markDirty();
			}}
		/>
	{/if}
{/snippet}

<div class="ui-page">
	<div class="settings-head">
		<div class="settings-t">
			<h2 class="settings-title">站点设置</h2>
			<span class="settings-count">{activeCat} · {groups.length} 个分组</span>
		</div>
		<p class="settings-note">
			顶部切换分类，下方按组铺开该分类的全部字段；修改后点右上角「保存全部」统一生效。
		</p>
		<div class="catbar">
			{#each CATEGORIES as c, i (c)}
				<button
					type="button"
					class="catbtn"
					class:on={i === activeIdx}
					onclick={() => (picked = { base: baseCat, idx: i })}
				>{c}</button>
			{/each}
		</div>
	</div>

	{#if message}
		<div class="save-msg" class:err={/失败|错误/.test(message)} role="status">{message}</div>
	{/if}

	{#if loading}
		<div class="ui-empty">加载中…</div>
	{:else if loadError}
		<div class="ui-empty">{loadError}</div>
	{:else}
		{#each groups as group (group.key)}
			<section class="card">
				<header class="cardhead">
					<h4>{group.title}</h4>
					<span class="cnt">{group.fields.filter((f) => isFieldVisible(f, cmtTypeVal)).length} 项</span>
					<code class="gkey">{group.key}</code>
				</header>
				<div class="cardbody">
					{#each blocksOf(group) as block (block.kind)}
						<div class="blk">
							<div class="blk-h">{block.title}</div>
							{#if block.kind === "switch" || block.kind === "page"}
								<div class="swgrid">
									{#each block.fields as field (field.name)}
										<label class="swrow" title={field.hint ?? field.label}>
											<span>{field.label}</span>
											<Switch
												on={data[group.key]?.[field.name] === true}
												label={field.label}
												toggle={() => cycleBool(group.key, field.name)}
											/>
										</label>
									{/each}
								</div>
							{:else if block.kind === "basic"}
								<div class="grid {block.span}">
									{#each block.fields as field (field.name)}
										<div class="fld">
											<span class="lbl" title={field.hint ?? field.label}>{field.label}</span>
											{@render control(group, field)}
										</div>
									{/each}
								</div>
							{:else}
								<div class="stack">
									{#each block.fields as field (field.name)}
										<div class="fld">
											<span class="lbl" title={field.hint ?? field.label}>{field.label}</span>
											{@render control(group, field)}
										</div>
									{/each}
								</div>
							{/if}
						</div>
					{/each}
				</div>
			</section>
		{/each}
	{/if}
</div>

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

<div class="crud-page">
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
		<div class="crud-empty">加载中…</div>
	{:else if loadError}
		<div class="crud-empty danger">{loadError}</div>
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

<style>
	/* 顶部横排分类条：5 类等宽 */
	.catbar {
		display: flex;
		gap: 4px;
		padding: 4px;
		background: var(--card-bg);
		border: 1px solid var(--line-color);
		border-radius: 12px;
	}
	.catbtn {
		flex: 1;
		min-width: 0;
		height: 36px;
		border: none;
		border-radius: 8px;
		background: transparent;
		color: var(--text-muted);
		font-family: inherit;
		font-size: 0.82rem;
		font-weight: 500;
		line-height: 1;
		cursor: pointer;
		transition: background 0.15s, color 0.15s;
	}
	.catbtn:hover {
		color: var(--deep-text);
	}
	.catbtn.on {
		background: var(--btn-regular-bg);
		color: var(--primary-text);
		font-weight: 650;
	}

	/* 组卡片 */
	.card {
		background: var(--card-bg);
		border: 1px solid var(--line-color);
		border-radius: 12px;
	}
	.cardhead {
		display: flex;
		align-items: baseline;
		gap: 8px;
		padding: 14px 16px;
		border-bottom: 1px solid var(--line-color);
	}
	.cardhead h4 {
		margin: 0;
		font-size: 0.92rem;
		font-weight: 700;
		color: var(--deep-text);
	}
	.cnt {
		font-size: 11px;
		font-weight: 400;
		color: var(--text-muted);
	}
	.gkey {
		margin-left: auto;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 11px;
		color: var(--text-muted);
	}
	.cardbody {
		display: flex;
		flex-direction: column;
		gap: 20px;
		padding: 16px;
	}
	.blk-h {
		margin-bottom: 10px;
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.06em;
		color: var(--text-muted);
	}

	/* 字段：标签 18 + 间距 6 + 控件 36 = 60，锁死行轨道保证同行对齐 */
	.grid {
		display: grid;
		grid-template-columns: repeat(6, minmax(0, 1fr));
		column-gap: 14px;
		row-gap: 18px;
	}
	.grid > .fld {
		grid-column: span 2;
	}
	.grid.rem2 > .fld:nth-last-child(2),
	.grid.rem2 > .fld:last-child {
		grid-column: span 3;
	}
	.grid.rem1 > .fld:nth-last-child(-n + 4) {
		grid-column: span 3;
	}
	.grid.solo > .fld {
		grid-column: span 6;
	}
	.fld {
		display: grid;
		grid-template-rows: 18px 36px;
		row-gap: 6px;
		min-width: 0;
	}
	.lbl {
		font-size: 12px;
		font-weight: 600;
		line-height: 18px;
		color: var(--deep-text);
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}
	.fld :is(input, select) {
		width: 100%;
		height: 36px;
		min-width: 0;
		padding: 0 10px;
		border: 1px solid var(--line-color);
		border-radius: 8px;
		background: var(--card-bg);
		color: var(--deep-text);
		font-family: inherit;
		font-size: 0.82rem;
		box-sizing: border-box;
	}
	.fld select {
		cursor: pointer;
	}
	.fld :is(input, select):focus {
		outline: none;
		border-color: var(--primary-text);
		box-shadow: 0 0 0 3px color-mix(in oklch, var(--primary-text) 18%, transparent);
	}
	.fld input::placeholder,
	.fld textarea::placeholder {
		color: color-mix(in oklch, var(--text-muted) 70%, transparent);
	}

	/* 长文本 / 结构化数据：整行，高度跟随内容 */
	.stack {
		display: flex;
		flex-direction: column;
		gap: 18px;
	}
	.stack > .fld {
		grid-template-rows: 18px auto;
	}
	.stack textarea {
		width: 100%;
		min-height: 82px;
		padding: 8px 10px;
		border: 1px solid var(--line-color);
		border-radius: 8px;
		background: var(--card-bg);
		color: var(--deep-text);
		font-family: inherit;
		font-size: 0.82rem;
		line-height: 1.55;
		box-sizing: border-box;
		resize: vertical;
	}
	.stack textarea:focus {
		outline: none;
		border-color: var(--primary-text);
		box-shadow: 0 0 0 3px color-mix(in oklch, var(--primary-text) 18%, transparent);
	}

	/* 开关：一行两个，行高 44；奇数时末项独占整行 */
	.swgrid {
		display: grid;
		grid-template-columns: repeat(6, minmax(0, 1fr));
		gap: 14px;
	}
	.swrow {
		grid-column: span 3;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		height: 44px;
		padding: 0 12px;
		border: 1px solid var(--line-color);
		border-radius: 8px;
		box-sizing: border-box;
		cursor: default;
	}
	.swrow:last-child:nth-child(odd) {
		grid-column: span 6;
	}
	.swrow > span {
		min-width: 0;
		font-size: 0.82rem;
		color: var(--deep-text);
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}

	.save-msg {
		margin: 0 0 0.8rem;
		padding: 0.55rem 0.9rem;
		border-radius: var(--radius-medium);
		font-size: 0.85rem;
		font-weight: 600;
		background: var(--btn-regular-bg);
		color: var(--primary-text);
		border: 1px solid var(--line-color);
	}
	.save-msg.err {
		background: color-mix(in oklch, var(--warning) 12%, transparent);
		color: var(--warning);
		border-color: color-mix(in oklch, var(--warning) 35%, transparent);
	}
	.crud-empty.danger {
		color: var(--warning);
		border-color: color-mix(in oklch, var(--warning) 40%, var(--line-color));
	}
</style>

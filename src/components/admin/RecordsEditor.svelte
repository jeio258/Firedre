<script lang="ts">
import { tick } from "svelte";
import type { RecordFieldSpec } from "./adminSettingsSchema";

interface Props {
	value?: unknown;
	recordFields?: RecordFieldSpec[];
	separator?: string;
	fieldLabel?: string;
	placeholder?: string;
	onChange?: (v: string) => void;
}
let {
	value = "",
	recordFields = [],
	separator = "|",
	fieldLabel = "",
	placeholder = "",
	onChange = () => {},
}: Props = $props();

// recordFields 仅一项且 key 为空时，按「纯字符串列表」处理（每行一条）
const isPlain = $derived(
	recordFields.length === 1 && recordFields[0]?.key === "",
);
const orderHint = $derived(
	isPlain
		? "每行一条"
		: recordFields.map((f) => f.label).join(` ${separator} `),
);

let open = $state(false);
let text = $state("");
let error = $state("");
let areaEl: HTMLTextAreaElement | undefined = $state();

// 存储值 → 行内文本
function cellToText(f: RecordFieldSpec, v: unknown): string {
	if (v == null) return "";
	if (f.valueType === "boolean") {
		return v === true || v === "true" ? "true" : "false";
	}
	return String(v);
}

// 行内文本 → 存储值（按声明类型转换）
function textToCell(f: RecordFieldSpec, raw: string): unknown {
	if (f.valueType === "boolean") {
		return ["true", "1", "是", "yes"].includes(raw);
	}
	if (f.valueType === "number") {
		const n = Number(raw);
		return Number.isNaN(n) ? raw : n;
	}
	return raw;
}

// JSON 字符串 → 行文本（结构对使用者不可见）
function toText(v: unknown): string {
	if (v == null || v === "") return "";
	try {
		const arr = typeof v === "string" ? JSON.parse(v) : v;
		if (!Array.isArray(arr)) return String(v);
		if (isPlain) {
			return arr
				.map((x) => (typeof x === "string" ? x : JSON.stringify(x)))
				.join("\n");
		}
		return arr
			.map((row) =>
				recordFields
					.map((f) => cellToText(f, (row as Record<string, unknown>)?.[f.key]))
					.join(` ${separator} `),
			)
			.join("\n");
	} catch {
		return String(v);
	}
}

// 行文本 → JSON 字符串（含字段级校验）
function parse(
	t: string,
): { ok: true; json: string } | { ok: false; error: string } {
	const lines = t
		.split("\n")
		.map((l) => l.trim())
		.filter(Boolean);
	if (isPlain) return { ok: true, json: JSON.stringify(lines) };
	const rows: Record<string, unknown>[] = [];
	for (let i = 0; i < lines.length; i++) {
		const parts = lines[i].split(separator).map((p) => p.trim());
		for (let k = 0; k < recordFields.length; k++) {
			const f = recordFields[k];
			const val = parts[k] ?? "";
			if (f.required && !val) {
				return { ok: false, error: `第 ${i + 1} 行缺少「${f.label}」` };
			}
			if (f.options && val && !f.options.includes(val)) {
				return {
					ok: false,
					error: `第 ${i + 1} 行「${f.label}」只能是 ${f.options.join(" / ")}`,
				};
			}
		}
		const row: Record<string, unknown> = {};
		recordFields.forEach((f, k) => {
			const val = parts[k] ?? "";
			if (val) row[f.key] = textToCell(f, val);
		});
		rows.push(row);
	}
	return { ok: true, json: JSON.stringify(rows) };
}

function openModal() {
	text = toText(value);
	error = "";
	open = true;
	tick().then(() => areaEl?.focus());
}

function onKeydown(e: KeyboardEvent) {
	if (open && e.key === "Escape") open = false;
}

function validate() {
	const r = parse(text);
	error = r.ok ? "" : r.error;
}

function save() {
	const r = parse(text);
	if (!r.ok) {
		error = r.error;
		return;
	}
	onChange(r.json === "[]" ? "" : r.json);
	open = false;
}

let preview = $derived.by(() => {
	if (value == null || value === "") return "（空）点击编辑";
	try {
		const arr = typeof value === "string" ? JSON.parse(value) : value;
		if (!Array.isArray(arr) || arr.length === 0) return "（空）点击编辑";
		const first = isPlain
			? String(arr[0])
			: recordFields
					.map((f) => cellToText(f, arr[0]?.[f.key]))
					.filter(Boolean)
					.join(" ");
		return `${arr.length} 条：${first.length > 28 ? `${first.slice(0, 28)}…` : first}`;
	} catch {
		return "（格式异常）点击编辑";
	}
});
</script>

<svelte:window onkeydown={onKeydown} />

<button type="button" class="re-trigger" onclick={openModal}>
	<span class="re-prev">{preview}</span>
	<span class="re-tag">编辑列表</span>
</button>

{#if open}
	<div class="re-mask" onclick={() => (open = false)} role="presentation">
		<div
			class="re-modal"
			onclick={(e) => e.stopPropagation()}
			role="dialog"
			aria-modal="true"
			aria-labelledby="re-title"
		>
			<header class="re-hd">
				<strong id="re-title">{fieldLabel}</strong>
				<button type="button" class="re-x" onclick={() => (open = false)} aria-label="关闭">✕</button>
			</header>
			<p class="re-hint">字段顺序：{orderHint}</p>
			<textarea
				class="re-area"
				bind:this={areaEl}
				bind:value={text}
				oninput={validate}
				spellcheck="false"
				placeholder={placeholder || orderHint}
			></textarea>
			{#if error}
				<p class="re-err">{error}</p>
			{/if}
			<footer class="re-ft">
				<span class="re-sp"></span>
				<button type="button" class="re-btn" onclick={() => (open = false)}>取消</button>
				<button type="button" class="re-btn primary" onclick={save} disabled={!!error}>保存</button>
			</footer>
		</div>
	</div>
{/if}

<style>
	.re-trigger {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		padding: 0.4rem 0.6rem;
		border: 1px solid var(--border-color, #d4d4d8);
		border-radius: 0.375rem;
		background: var(--card-bg, #fff);
		cursor: pointer;
		text-align: left;
	}
	.re-prev {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 0.8125rem;
		color: var(--content-meta, #71717a);
	}
	.re-tag {
		flex-shrink: 0;
		font-size: 0.75rem;
		color: var(--primary, #3b82f6);
	}
	.re-mask {
		position: fixed;
		inset: 0;
		z-index: 60;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgb(0 0 0 / 0.45);
	}
	.re-modal {
		width: min(44rem, 92vw);
		max-height: 84vh;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 1rem;
		border-radius: 0.5rem;
		background: var(--card-bg, #fff);
	}
	.re-hd {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.re-x {
		border: none;
		background: none;
		cursor: pointer;
		font-size: 1rem;
	}
	.re-hint {
		margin: 0;
		font-size: 0.75rem;
		color: var(--content-meta, #71717a);
	}
	.re-area {
		flex: 1;
		min-height: 14rem;
		padding: 0.5rem;
		border: 1px solid var(--border-color, #d4d4d8);
		border-radius: 0.375rem;
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		font-size: 0.8125rem;
		line-height: 1.6;
		resize: vertical;
	}
	.re-err {
		margin: 0;
		font-size: 0.75rem;
		color: var(--danger, #ef4444);
	}
	.re-ft {
		display: flex;
		gap: 0.5rem;
	}
	.re-sp {
		flex: 1;
	}
	.re-btn {
		padding: 0.3rem 0.9rem;
		border: 1px solid var(--border-color, #d4d4d8);
		border-radius: 0.375rem;
		background: var(--card-bg, #fff);
		cursor: pointer;
		font-size: 0.8125rem;
	}
	.re-btn.primary {
		border-color: var(--primary, #3b82f6);
		background: var(--primary, #3b82f6);
		color: #fff;
	}
	.re-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>

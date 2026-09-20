<script lang="ts">
import { tick } from "svelte";
import type { RecordFieldSpec } from "./adminSettingsSchema";

interface Props {
	value?: unknown;
	recordFields?: RecordFieldSpec[];
	objectFields?: RecordFieldSpec[];
	groupFields?: RecordFieldSpec[];
	itemFields?: RecordFieldSpec[];
	indent?: string;
	separator?: string;
	fieldLabel?: string;
	placeholder?: string;
	onChange?: (v: string) => void;
}
let {
	value = "",
	recordFields = [],
	objectFields = [],
	groupFields = [],
	itemFields = [],
	indent = "  ",
	separator = "|",
	fieldLabel = "",
	placeholder = "",
	onChange = () => {},
}: Props = $props();

// 三种模式互斥：对象（单行）/ 两级嵌套（缩进）/ 记录数组（每行一条）
const isNested = $derived(groupFields.length > 0 && itemFields.length > 0);
const isObject = $derived(!isNested && objectFields.length > 0);
const activeFields = $derived(isObject ? objectFields : recordFields);
// recordFields 仅一项且 key 为空时，按「纯字符串列表」处理（每行一条）
const isPlain = $derived(
	!isObject &&
		!isNested &&
		recordFields.length === 1 &&
		recordFields[0]?.key === "",
);
const orderHint = $derived(
	isNested
		? `分组行（顶格）：${groupFields.map((f) => f.label).join(` ${separator} `)}\n子项行（缩进 ${indent.length} 空格）：${itemFields.map((f) => f.label).join(` ${separator} `)}`
		: isObject
			? `单行填写，字段顺序：${objectFields.map((f) => f.label).join(` ${separator} `)}`
			: isPlain
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
	if (f.valueType === "list") {
		return Array.isArray(v) ? v.join(",") : String(v);
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
	if (f.valueType === "list") {
		return raw
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean);
	}
	return raw;
}

// 把一行文本拆成字段值（对象模式下用于单行）
function splitCells(line: string): string[] {
	return line.split(separator).map((p) => p.trim());
}

// 字段级校验，返回错误信息（无错返回 ""）
function validateCells(
	fields: RecordFieldSpec[],
	parts: string[],
	rowLabel: string,
): string {
	for (let k = 0; k < fields.length; k++) {
		const f = fields[k];
		const val = parts[k] ?? "";
		if (f.required && !val) return `${rowLabel}缺少「${f.label}」`;
		if (f.options && val && !f.options.includes(val)) {
			return `${rowLabel}「${f.label}」只能是 ${f.options.join(" / ")}`;
		}
	}
	return "";
}

// 按字段声明把一行组装成对象（“-”占位符视为空，避免被当作有效值）
function cellsToRow(
	fields: RecordFieldSpec[],
	parts: string[],
): Record<string, unknown> {
	const row: Record<string, unknown> = {};
	fields.forEach((f, k) => {
		const val = parts[k] ?? "";
		if (val && val !== "-" && val !== "—") row[f.key] = textToCell(f, val);
	});
	return row;
}

// JSON 字符串 → 行文本（结构对使用者不可见）
function toText(v: unknown): string {
	if (v == null || v === "") return "";
	try {
		const parsed = typeof v === "string" ? JSON.parse(v) : v;
		if (isObject) {
			if (
				parsed == null ||
				typeof parsed !== "object" ||
				Array.isArray(parsed)
			) {
				return String(v);
			}
			return objectFields
				.map((f) => cellToText(f, (parsed as Record<string, unknown>)[f.key]))
				.join(` ${separator} `);
		}
		if (!Array.isArray(parsed)) return String(v);
		if (isPlain) {
			return parsed
				.map((x) => (typeof x === "string" ? x : JSON.stringify(x)))
				.join("\n");
		}
		if (isNested) {
			return parsed
				.map((g) => {
					const head = groupFields
						.map((f) => cellToText(f, (g as Record<string, unknown>)?.[f.key]))
						.join(` ${separator} `);
					const items = Array.isArray((g as { items?: unknown[] }).items)
						? ((g as { items: unknown[] }).items as Record<string, unknown>[])
						: [];
					const childLines = items.map(
						(it) =>
							indent +
							itemFields
								.map((f) => cellToText(f, it?.[f.key]))
								.join(` ${separator} `),
					);
					return [head, ...childLines].join("\n");
				})
				.join("\n");
		}
		return parsed
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
	if (isObject) {
		const line = t.split("\n")[0]?.trim() ?? "";
		if (!line) return { ok: true, json: "{}" };
		const parts = splitCells(line);
		const err = validateCells(objectFields, parts, "");
		if (err) return { ok: false, error: err };
		return { ok: true, json: JSON.stringify(cellsToRow(objectFields, parts)) };
	}
	if (isNested) {
		// 顶格行 = 分组，缩进行 = 该分组的子项
		const groups: Record<string, unknown>[] = [];
		let current: (Record<string, unknown> & { items: unknown[] }) | null = null;
		const rawLines = t.split("\n");
		for (let i = 0; i < rawLines.length; i++) {
			const raw = rawLines[i];
			if (!raw.trim()) continue;
			const line = raw.trim();
			const isChild = /^\s/.test(raw);
			if (isChild) {
				if (!current) {
					return {
						ok: false,
						error: `第 ${i + 1} 行是子项，但其上方没有分组行`,
					};
				}
				const parts = splitCells(line);
				const err = validateCells(itemFields, parts, `第 ${i + 1} 行`);
				if (err) return { ok: false, error: err };
				current.items.push(cellsToRow(itemFields, parts));
			} else {
				const parts = splitCells(line);
				const err = validateCells(groupFields, parts, `第 ${i + 1} 行`);
				if (err) return { ok: false, error: err };
				current = { ...cellsToRow(groupFields, parts), items: [] };
				groups.push(current);
			}
		}
		return { ok: true, json: JSON.stringify(groups) };
	}
	const lines = t
		.split("\n")
		.map((l) => l.trim())
		.filter(Boolean);
	if (isPlain) return { ok: true, json: JSON.stringify(lines) };
	const rows: Record<string, unknown>[] = [];
	for (let i = 0; i < lines.length; i++) {
		const parts = splitCells(lines[i]);
		const err = validateCells(activeFields, parts, `第 ${i + 1} 行`);
		if (err) return { ok: false, error: err };
		rows.push(cellsToRow(activeFields, parts));
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
	onChange(r.json === "[]" || r.json === "{}" ? "" : r.json);
	open = false;
}

let preview = $derived.by(() => {
	if (value == null || value === "") return "（空）点击编辑";
	try {
		const parsed = typeof value === "string" ? JSON.parse(value) : value;
		if (isObject) {
			if (
				parsed == null ||
				typeof parsed !== "object" ||
				Array.isArray(parsed)
			) {
				return "（格式异常）点击编辑";
			}
			const line = objectFields
				.map((f) => cellToText(f, (parsed as Record<string, unknown>)[f.key]))
				.filter(Boolean)
				.join(" ");
			return line.length > 40 ? `${line.slice(0, 40)}…` : line;
		}
		if (!Array.isArray(parsed) || parsed.length === 0) return "（空）点击编辑";
		if (isNested) {
			const g0 = parsed[0] as Record<string, unknown>;
			const name = groupFields
				.map((f) => cellToText(f, g0?.[f.key]))
				.filter(Boolean)
				.join(" ");
			const childCount = Array.isArray(g0?.items)
				? (g0.items as unknown[]).length
				: 0;
			return `${parsed.length} 组：${name}（含 ${childCount} 项）`;
		}
		const first = isPlain
			? String(parsed[0])
			: recordFields
					.map((f) => cellToText(f, parsed[0]?.[f.key]))
					.filter(Boolean)
					.join(" ");
		return `${parsed.length} 条：${first.length > 28 ? `${first.slice(0, 28)}…` : first}`;
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
		min-width: 0;
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

	/* 移动端输入控件字号达物理 16px（admin 根字号恒 16px），防 iOS 聚焦缩放 */
	@media (max-width: 767px) {
		.re-area {
			font-size: 1rem;
		}
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

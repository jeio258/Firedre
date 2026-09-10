<script lang="ts">
	import { tick } from "svelte";

	interface Props {
		value?: unknown;
		placeholder?: string;
		fieldLabel?: string;
		onChange?: (v: unknown) => void;
	}
	let {
		value = "",
		placeholder = "",
		fieldLabel = "",
		onChange = () => {},
	}: Props = $props();

	let open = $state(false);
	let text = $state("");
	let error = $state("");
	let areaEl: HTMLTextAreaElement | undefined = $state();

	async function openModal() {
		try {
			text = value == null || value === "" ? "" : JSON.stringify(value, null, 2);
		} catch {
			text = String(value ?? "");
		}
		error = "";
		open = true;
		await tick();
		areaEl?.focus();
	}

	function onKeydown(e: KeyboardEvent) {
		if (open && e.key === "Escape") open = false;
	}

	function validate(): boolean {
		if (text.trim() === "") {
			error = "";
			return true;
		}
		try {
			JSON.parse(text);
			error = "";
			return true;
		} catch (e) {
			error = (e as Error).message;
			return false;
		}
	}

	function format() {
		if (validate()) text = JSON.stringify(JSON.parse(text), null, 2);
	}

	function save() {
		if (text.trim() === "") {
			onChange("");
			open = false;
			return;
		}
		if (!validate()) return;
		onChange(JSON.parse(text));
		open = false;
	}

	let preview = $derived.by(() => {
		if (value == null || value === "") return "（空）点击编辑";
		try {
			const s = JSON.stringify(value);
			return s.length > 46 ? s.slice(0, 46) + "…" : s;
		} catch {
			return String(value);
		}
	});
</script>

<svelte:window onkeydown={onKeydown} />

<button type="button" class="je-trigger" onclick={openModal}>
	<span class="je-prev">{preview}</span>
	<span class="je-tag">编辑 JSON</span>
</button>

{#if open}
	<div
		class="je-mask"
		onclick={() => (open = false)}
		role="presentation"
	>
		<div
			class="je-modal"
			onclick={(e) => e.stopPropagation()}
			role="dialog"
			aria-modal="true"
			aria-labelledby="je-title"
		>
			<header class="je-hd">
				<strong id="je-title">{fieldLabel}</strong>
				<button type="button" class="je-x" onclick={() => (open = false)} aria-label="关闭">✕</button>
			</header>
			<textarea
				class="je-area"
				bind:this={areaEl}
				bind:value={text}
				oninput={validate}
				spellcheck="false"
				placeholder={placeholder}
			></textarea>
			{#if error}
				<p class="je-err">JSON 格式错误：{error}</p>
			{/if}
			<footer class="je-ft">
				<button type="button" class="je-btn ghost" onclick={format}>格式化</button>
				<span class="je-sp"></span>
				<button type="button" class="je-btn" onclick={() => (open = false)}>取消</button>
				<button type="button" class="je-btn primary" onclick={save} disabled={!!error}>保存</button>
			</footer>
		</div>
	</div>
{/if}

<script lang="ts">
	export let value: unknown = "";
	export let placeholder: string = "";
	export let fieldLabel: string = "";
	export let onChange: (v: unknown) => void = () => {};

	let open = false;
	let text = "";
	let error = "";

	function openModal() {
		try {
			text = value == null || value === "" ? "" : JSON.stringify(value, null, 2);
		} catch {
			text = String(value ?? "");
		}
		error = "";
		open = true;
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

	$: preview = (() => {
		if (value == null || value === "") return "（空）点击编辑";
		try {
			const s = JSON.stringify(value);
			return s.length > 46 ? s.slice(0, 46) + "…" : s;
		} catch {
			return String(value);
		}
	})();
</script>

<button type="button" class="je-trigger" on:click={openModal}>
	<span class="je-prev">{preview}</span>
	<span class="je-tag">编辑 JSON</span>
</button>

{#if open}
	<div class="je-mask" on:click={() => (open = false)} role="presentation">
		<div class="je-modal" on:click|stopPropagation role="dialog" aria-modal="true">
			<header class="je-hd">
				<strong>{fieldLabel}</strong>
				<button type="button" class="je-x" on:click={() => (open = false)} aria-label="关闭">✕</button>
			</header>
			<textarea
				class="je-area"
				bind:value={text}
				on:input={validate}
				spellcheck="false"
				placeholder={placeholder}
			></textarea>
			{#if error}
				<p class="je-err">JSON 格式错误：{error}</p>
			{/if}
			<footer class="je-ft">
				<button type="button" class="je-btn ghost" on:click={format}>格式化</button>
				<span class="je-sp"></span>
				<button type="button" class="je-btn" on:click={() => (open = false)}>取消</button>
				<button type="button" class="je-btn primary" on:click={save} disabled={!!error}>保存</button>
			</footer>
		</div>
	</div>
{/if}

<script lang="ts">
	import { onMount } from "svelte";
	import { apiJson } from "@/lib/adminApi";

	interface Props {
		group: string;
		enableKey: string;
		enableLabel: string;
		title: string;
		titleField?: string;
		descField?: string;
	}

	let {
		group,
		enableKey,
		enableLabel,
		title,
		titleField = "",
		descField = "",
	}: Props = $props();

	let enabled = $state(false);
	let titleVal = $state("");
	let descVal = $state("");
	let loading = $state(true);
	let saving = $state(false);

	async function load() {
		loading = true;
		try {
			const data = await apiJson<Record<string, unknown>>(`/api/settings/?group=${group}`);
			enabled = Boolean(data[enableKey]);
			if (titleField) titleVal = String(data[titleField] ?? "");
			if (descField) descVal = String(data[descField] ?? "");
		} catch {
		}
		loading = false;
	}

	async function toggle() {
		enabled = !enabled;
		saving = true;
		try {
			await fetch("/api/settings/", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ groups: { [group]: { [enableKey]: enabled } } }),
			});
		} catch {
		}
		saving = false;
	}

	onMount(load);
</script>

<details class="modcfg">
	<summary>
		<span class="mct">{title}</span>
		<span class="mccaret">▾</span>
	</summary>
	<div class="mcin">
		<label class="mctr">
			<span>{enableLabel}</span>
			<button
				class="sw"
				class:on={enabled}
				role="switch"
				aria-checked={enabled}
				aria-label={enableLabel}
				on:click={toggle}
				disabled={saving}
			></button>
		</label>
		{#if titleField}
			<div class="mcfg">
				<div class="a2f">
					<label>页面标题</label>
					<input type="text" bind:value={titleVal} />
				</div>
				{#if descField}
					<div class="a2f w">
						<label>页面描述</label>
						<textarea rows="3" bind:value={descVal}></textarea>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</details>

<script lang="ts">
import { onMount } from "svelte";
import { apiJson } from "@/lib/adminApi";
import Switch from "./Switch.svelte";

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
let loadError = $state("");

async function load() {
	loading = true;
	loadError = "";
	try {
		const data = await apiJson<Record<string, unknown>>(
			`/api/settings/?group=${group}`,
		);
		enabled = Boolean(data[enableKey]);
		if (titleField) titleVal = String(data[titleField] ?? "");
		if (descField) descVal = String(data[descField] ?? "");
	} catch (err) {
		// 加载失败必须显式告警：否则表单以空/默认值呈现，管理员可能据此覆盖真实配置
		loadError = err instanceof Error ? err.message : "网络错误";
	}
	loading = false;
}

async function toggle() {
	if (loadError) return;
	enabled = !enabled;
	saving = true;
	try {
		await apiJson("/api/settings/", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ groups: { [group]: { [enableKey]: enabled } } }),
		});
	} catch {
		enabled = !enabled;
	}
	saving = false;
}

onMount(load);
</script>

<details class="ui-card cfg">
	<summary class="ui-card-h">
		<span>{title}</span>
		<span class="caret">▾</span>
	</summary>
	<div class="ui-card-b cfg-body">
		{#if loadError}
			<p class="ui-badge ui-badge-warn load-err" role="alert">
				加载失败：{loadError}。当前显示值不可信，请勿改动，稍后重试。
			</p>
		{/if}
		<label class="toggle-row">
			<span>{enableLabel}</span>
			<Switch on={enabled} label={enableLabel} toggle={toggle} disabled={saving || loadError !== ""} />
		</label>
		{#if titleField}
			<div class="ui-grid">
				<label class="ui-field">
					<span class="ui-label">页面标题</span>
					<input class="ui-input" type="text" aria-label="页面标题" bind:value={titleVal} />
				</label>
				{#if descField}
					<label class="ui-field field-wide">
						<span class="ui-label">页面描述</span>
						<textarea class="ui-input" rows="3" aria-label="页面描述" bind:value={descVal}></textarea>
					</label>
				{/if}
			</div>
		{/if}
	</div>
</details>

<style>
	.cfg > summary {
		cursor: pointer;
		list-style: none;
	}
	.cfg > summary::-webkit-details-marker {
		display: none;
	}
	.caret {
		margin-left: auto;
		transition: transform 0.18s;
	}
	.cfg[open] .caret {
		transform: rotate(180deg);
	}
	.cfg-body {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.toggle-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
	}
	.field-wide {
		grid-column: 1 / -1;
		grid-template-rows: 18px auto;
	}
	textarea.ui-input {
		height: auto;
		min-height: 72px;
		padding: 8px 10px;
		line-height: 1.5;
		resize: vertical;
	}
	.load-err {
		display: block;
		margin: 0;
		padding: 6px 10px;
		line-height: 1.5;
		white-space: normal;
	}
</style>

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

<details class="modcfg">
	<summary>
		<span class="mct">{title}</span>
		<span class="mccaret">▾</span>
	</summary>
	<div class="mcin">
		{#if loadError}
			<p class="mc-err">加载失败：{loadError}。当前显示值不可信，请勿改动，稍后重试。</p>
		{/if}
		<label class="mctr">
			<span>{enableLabel}</span>
			<Switch on={enabled} label={enableLabel} toggle={toggle} disabled={saving || loadError !== ""} />
		</label>
		{#if titleField}
			<div class="mcfg">
				<div class="a2f">
					<label>页面标题</label>
					<input type="text" aria-label="页面标题" bind:value={titleVal} />
				</div>
				{#if descField}
					<div class="a2f w">
						<label>页面描述</label>
						<textarea rows="3" aria-label="页面描述" bind:value={descVal}></textarea>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</details>

<style>
	.mc-err {
		margin: 0 0 0.5rem;
		padding: 0.4rem 0.55rem;
		border-radius: 0.4rem;
		background: rgba(220, 38, 38, 0.1);
		color: #dc2626;
		font-size: 0.82rem;
		line-height: 1.5;
	}
</style>

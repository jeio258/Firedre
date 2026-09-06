<script lang="ts">
	import { onMount } from "svelte";

	export let data: { name: string; value: number }[] = [];
	export let height = 230;
	export let colors = ["#0f766e", "#0ea5e9", "#10b981", "#f59e0b", "#f43f5e", "#8b5cf6", "#14b8a6"];

	let w = 0;
	let textColor = "#94a3b8";
	let gridColor = "rgba(148, 163, 184, 0.35)";

	function palette() {
		const cs = getComputedStyle(document.documentElement);
		textColor = "var(--text-muted)";
		gridColor = "var(--line-divider)";
		const p = cs.getPropertyValue("--primary").trim();
		if (p) colors = [p, ...colors.filter((c) => c !== p)];
	}

	onMount(palette);
</script>

<div class="bar-wrap" bind:clientWidth={w} style="width:100%;height:{height}px">
	{#if w > 0}
		{@const pad = { top: 12, right: 8, bottom: 28, left: 30 }}
		{@const innerW = w - pad.left - pad.right}
		{@const innerH = height - pad.top - pad.bottom}
		{@const maxV = Math.max(1, ...data.map((d) => d.value))}
		{@const y = (v: number) => pad.top + innerH - (v / maxV) * innerH}
		{@const n = Math.max(1, data.length)}
		{@const slot = innerW / n}
		{@const bw = Math.min(44, slot * 0.55)}
		<svg width={w} height={height} role="img" style="display:block">
			{#each [0, 1, 2, 3] as gi (gi)}
				{@const gy = pad.top + (innerH / 3) * gi}
				{@const gv = Math.round(maxV - (maxV / 3) * gi)}
				<line x1={pad.left} y1={gy} x2={w - pad.right} y2={gy} style="stroke:{gridColor}" stroke-width="1" stroke-dasharray="3 3" />
				<text x={pad.left - 6} y={gy + 3.5} text-anchor="end" font-size="11" style="fill:{textColor}">{gv}</text>
			{/each}
			{#each data as d, i (d.name)}
				{@const bx = pad.left + slot * i + (slot - bw) / 2}
				{@const top = y(d.value)}
				<rect
					x={bx}
					y={top}
					width={bw}
					height={pad.top + innerH - top}
					rx={Math.min(6, bw / 2)}
					fill={colors[i % colors.length]}
				/>
				<text
					x={pad.left + slot * i + slot / 2}
					y={height - 8}
					text-anchor="middle"
					font-size="11"
					style="fill:{textColor}"
				>{d.name}</text>
			{/each}
		</svg>
	{:else}
		<div class="chart-empty">加载中…</div>
	{/if}
</div>

<style>
	.bar-wrap {
		position: relative;
	}
	.chart-empty {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		color: var(--text-muted);
		font-size: 0.85rem;
	}
</style>

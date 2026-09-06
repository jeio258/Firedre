<script lang="ts">
	import { onMount } from "svelte";

	// 通用笛卡尔图表（面积折线 / 柱状），替代原 AdminAreaChart + AdminBarChart
	// kind=area：values 为多序列二维数组，colors 按序列取色
	// kind=bar：values 单序列（values[0]），colors 按 x 列循环取色
	export let xLabels: string[] = [];
	export let values: number[][] = [];
	export let colors: string[] = [];
	export let kind: "area" | "bar" = "bar";
	export let height = 240;

	const DEFAULT_COLORS = ["#0f766e", "#0ea5e9", "#10b981", "#f59e0b", "#f43f5e", "#8b5cf6", "#14b8a6"];

	let w = 0;
	let textColor = "#94a3b8";
	let gridColor = "rgba(148, 163, 184, 0.35)";

	function palette() {
		const cs = getComputedStyle(document.documentElement);
		textColor = "var(--text-muted)";
		gridColor = "var(--line-divider)";
		if (colors.length === 0) {
			const p = cs.getPropertyValue("--primary").trim();
			colors = p ? [p, ...DEFAULT_COLORS.filter((c) => c !== p)] : [...DEFAULT_COLORS];
		}
	}

	onMount(palette);
</script>

<div class="chart-wrap" bind:clientWidth={w} style="width:100%;height:{height}px">
	{#if w > 0}
		{@const pad = { top: 14, right: 8, bottom: 24, left: 30 }}
		{@const innerW = w - pad.left - pad.right}
		{@const innerH = height - pad.top - pad.bottom}
		{@const allV = values.length > 0 ? values.flat() : [0]}
		{@const maxV = Math.max(1, ...allV)}
		{@const y = (v: number) => pad.top + innerH - (v / maxV) * innerH}
		{@const x = (i: number) =>
			pad.left + (xLabels.length === 1 ? innerW / 2 : (i / Math.max(1, xLabels.length - 1)) * innerW)}
		<svg width={w} height={height} role="img" style="display:block">
			{#if kind === "area"}
				<defs>
					{#each values as _, si (si)}
						<linearGradient id="cartGrad{si}" x1="0" y1="0" x2="0" y2="1">
							<stop offset="0%" stop-color={colors[si] || DEFAULT_COLORS[si]} stop-opacity="0.3" />
							<stop offset="100%" stop-color={colors[si] || DEFAULT_COLORS[si]} stop-opacity="0" />
						</linearGradient>
					{/each}
				</defs>
			{/if}
			<!-- 横网格线 + y 刻度 -->
			{#each [0, 1, 2, 3] as gi (gi)}
				{@const gy = pad.top + (innerH / 3) * gi}
				{@const gv = Math.round(maxV - (maxV / 3) * gi)}
				<line x1={pad.left} y1={gy} x2={w - pad.right} y2={gy} style="stroke:{gridColor}" stroke-width="1" stroke-dasharray="3 3" />
				<text x={pad.left - 6} y={gy + 3.5} text-anchor="end" font-size="11" style="fill:{textColor}">{gv}</text>
			{/each}

			{#if kind === "area"}
				{#each values as _, si (si)}
					{@const line = values[si].map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("")}
					{#if values[si].length > 1}
						<path
							d={line + ` L${x(values[si].length - 1).toFixed(1)},${(pad.top + innerH).toFixed(1)} L${x(0).toFixed(1)},${(pad.top + innerH).toFixed(1)} Z`}
							fill="url(#cartGrad{si})"
						/>
					{/if}
					<path d={line} fill="none" style="stroke:{colors[si] || DEFAULT_COLORS[si]}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
				{/each}
			{:else}
				{#each xLabels as _, i (i)}
					{@const slot = innerW / Math.max(1, xLabels.length)}
					{@const bw = Math.min(44, slot * 0.55)}
					{@const bx = pad.left + slot * i + (slot - bw) / 2}
					{@const v = values[0]?.[i] ?? 0}
					{@const top = y(v)}
					<rect x={bx} y={top} width={bw} height={pad.top + innerH - top} rx={Math.min(6, bw / 2)} fill={colors[i % colors.length] || DEFAULT_COLORS[i % DEFAULT_COLORS.length]} />
				{/each}
			{/if}
			<!-- x 轴标签 -->
			{#each xLabels as label, i (label)}
				<text x={x(i)} y={height - 7} text-anchor="middle" font-size="11" style="fill:{textColor}">{label}</text>
			{/each}
		</svg>
	{:else}
		<div class="chart-empty">加载中…</div>
	{/if}
</div>

<style>
	.chart-wrap {
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

<script lang="ts">
	import { onMount } from "svelte";

	// 面积/折线图：发布 vs 草稿 双序列，颜色由外部传入（运行时取主题令牌）
	export let data: { label: string; 发布: number; 草稿: number }[] = [];
	export let colors: { 发布: string; 草稿: string } = { 发布: "#0f766e", 草稿: "#0ea5e9" };
	export let height = 240;

	let w = 0;
	let gridColor = "rgba(148, 163, 184, 0.35)";
	let textColor = "#94a3b8";

	function palette() {
		const cs = getComputedStyle(document.documentElement);
		gridColor = "var(--line-divider)";
		textColor = "var(--text-muted)";
		colors = {
			发布: cs.getPropertyValue("--primary").trim() || colors.发布,
			草稿: colors.草稿,
		};
	}

	onMount(palette);
</script>

<div class="chart-wrap" bind:clientWidth={w} style="width:100%;height:{height}px">
	{#if w > 0}
		{@const pad = { top: 14, right: 8, bottom: 24, left: 30 }}
		{@const innerW = w - pad.left - pad.right}
		{@const innerH = height - pad.top - pad.bottom}
		{@const maxV = Math.max(1, ...data.flatMap((d) => [d.发布, d.草稿]))}
		{@const y = (v: number) => pad.top + innerH - (v / maxV) * innerH}
		{@const x = (i: number) => pad.left + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW)}
		<svg
			width={w}
			height={height}
			role="img"
			style="display:block"
		>
			<defs>
				<linearGradient id="chartGradPub" x1="0" y1="0" x2="0" y2="1">
					<stop offset="0%" stop-color={colors.发布} stop-opacity="0.3" />
					<stop offset="100%" stop-color={colors.发布} stop-opacity="0" />
				</linearGradient>
				<linearGradient id="chartGradDft" x1="0" y1="0" x2="0" y2="1">
					<stop offset="0%" stop-color={colors.草稿} stop-opacity="0.22" />
					<stop offset="100%" stop-color={colors.草稿} stop-opacity="0" />
				</linearGradient>
			</defs>
			<!-- 横网格线 + y 刻度 -->
			{#each [0, 1, 2, 3] as gi (gi)}
				{@const gy = pad.top + (innerH / 3) * gi}
				{@const gv = Math.round(maxV - (maxV / 3) * gi)}
				<line x1={pad.left} y1={gy} x2={w - pad.right} y2={gy} style="stroke:{gridColor}" stroke-width="1" stroke-dasharray="3 3" />
				<text x={pad.left - 6} y={gy + 3.5} text-anchor="end" font-size="11" style="fill:{textColor}">{gv}</text>
			{/each}
			<!-- 序列面积 -->
			{#if data.length > 1}
				<path
					d={data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d.草稿).toFixed(1)}`).join("") + ` L${x(data.length - 1).toFixed(1)},${(pad.top + innerH).toFixed(1)} L${x(0).toFixed(1)},${(pad.top + innerH).toFixed(1)} Z`}
					fill="url(#chartGradDft)"
				/>
				<path
					d={data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d.草稿).toFixed(1)}`).join("")}
					fill="none"
					style="stroke:{colors.草稿}"
					stroke-width="2"
					stroke-linejoin="round"
					stroke-linecap="round"
				/>
			{/if}
			<path
				d={data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d.发布).toFixed(1)}`).join("") + ` L${x(data.length - 1).toFixed(1)},${(pad.top + innerH).toFixed(1)} L${x(0).toFixed(1)},${(pad.top + innerH).toFixed(1)} Z`}
				fill="url(#chartGradPub)"
			/>
			<path
				d={data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d.发布).toFixed(1)}`).join("")}
				fill="none"
				style="stroke:{colors.发布}"
				stroke-width="2"
				stroke-linejoin="round"
				stroke-linecap="round"
			/>
			<!-- x 轴月份 -->
			{#each data as d, i (d.label)}
				<text
					x={x(i)}
					y={height - 7}
					text-anchor="middle"
					font-size="11"
					style="fill:{textColor}"
				>{d.label}</text>
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

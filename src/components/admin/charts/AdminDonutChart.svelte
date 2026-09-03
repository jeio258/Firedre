<script lang="ts">
	import { onMount } from "svelte";

	export let data: { name: string; value: number; color: string }[] = [];
	export let size = 180;
	export let thickness = 22;
	export let centerText = "";
	export let centerSub = "";
	export let fallbackColors = ["#10b981", "#94a3b8", "#f59e0b", "#f43f5e", "#8b5cf6", "#0ea5e9"];

	let textColor = "#94a3b8";

	function palette() {
		const cs = getComputedStyle(document.documentElement);
		textColor = "var(--text-muted)";
		const p = cs.getPropertyValue("--primary").trim();
		if (p) fallbackColors[0] = p;
	}

	onMount(palette);

	const r = size / 2 - thickness / 2;
	const C = 2 * Math.PI * r;
	$: total = data.reduce((s, d) => s + d.value, 0);
	$: data = data.map((d, i) => ({ ...d, color: d.color || fallbackColors[i % fallbackColors.length] }));
	$: ctext = centerText || String(total);
</script>

<div class="donut" style="width:{size}px;height:{size}px">
	<svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img">
		{#if total > 0}
			{@const seg = (frac: number, offset: number) => `${frac * C} ${C - frac * C}`}
			{#each data as d, i (d.name)}
				{@const frac = d.value / total}
				{@const offset = data.slice(0, i).reduce((s, x) => s + x.value / total, 0)}
				<circle
					cx={size / 2}
					cy={size / 2}
					r={r}
					fill="none"
					stroke={d.color}
					stroke-width={thickness}
					stroke-dasharray={seg(frac, offset)}
					stroke-dashoffset={-offset * C}
					transform={`rotate(-90 ${size / 2} ${size / 2})`}
				/>
			{/each}
		{:else}
			<circle
				cx={size / 2}
				cy={size / 2}
				r={r}
				fill="none"
				stroke="var(--line-divider)"
				stroke-width={thickness}
			/>
		{/if}
	</svg>
	<div class="donut-center">
		<div class="donut-value">{ctext}</div>
		{#if centerSub}<div class="donut-sub" style="color:{textColor}">{centerSub}</div>{/if}
	</div>
</div>

<style>
	.donut {
		position: relative;
		margin: 0 auto;
	}
	.donut-center {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.15rem;
		pointer-events: none;
	}
	.donut-value {
		font-size: 1.6rem;
		font-weight: 700;
		line-height: 1;
		color: var(--deep-text);
	}
	.donut-sub {
		font-size: 0.75rem;
	}
</style>

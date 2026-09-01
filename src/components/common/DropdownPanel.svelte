<script lang="ts">

import type { Snippet } from "svelte";

interface Props {
	class?: string;
	children?: Snippet;
}

let { class: className = "", children, ...restProps }: Props = $props();
</script>

<div class={`float-panel p-2 ${className}`.trim()} role="none" {...restProps}>
	{#if children}
		{@render children()}
	{/if}
</div>

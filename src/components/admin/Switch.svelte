<script lang="ts">
	interface Props {
		on: boolean;
		label: string;
		toggle: () => void;
		disabled?: boolean;
	}
	let { on, label, toggle, disabled = false }: Props = $props();
</script>

<button
	type="button"
	class="sw"
	class:on={on}
	role="switch"
	aria-checked={on}
	aria-label={label}
	{disabled}
	onclick={toggle}
></button>

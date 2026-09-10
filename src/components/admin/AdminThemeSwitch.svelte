<script lang="ts">
	import { onMount } from "svelte";
	import { setTheme, getStoredTheme } from "@/utils/setting-utils";
	import { LIGHT_MODE, DARK_MODE, SYSTEM_MODE } from "@/constants/constants";
	import type { LIGHT_DARK_MODE } from "@/types/config";

	let mode: LIGHT_DARK_MODE = LIGHT_MODE;
	let open = false;

	const ICONS = {
		sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>',
		moon: '<path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.6 6.6 0 0 0 9.8 9.8z"/>',
		auto: '<path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.39 5.39 0 0 1-8.54-7.54A8.9 8.9 0 0 0 12 3z"/>',
	};
	const OPTIONS: { value: LIGHT_DARK_MODE; label: string; icon: keyof typeof ICONS }[] = [
		{ value: LIGHT_MODE, label: "浅色", icon: "sun" },
		{ value: DARK_MODE, label: "深色", icon: "moon" },
		{ value: SYSTEM_MODE, label: "跟随系统", icon: "auto" },
	];

	function currentIcon(): string {
		if (mode === SYSTEM_MODE) return ICONS.auto;
		return mode === DARK_MODE ? ICONS.moon : ICONS.sun;
	}
	function pick(v: LIGHT_DARK_MODE) {
		mode = v;
		setTheme(v);
		open = false;
	}
	function toggle() {
		open = !open;
	}
	function sync() {
		mode = getStoredTheme();
	}
	function onDocClick(e: MouseEvent) {
		if (!(e.target as HTMLElement).closest(".theme-switch")) open = false;
	}

	onMount(() => {
		sync();
		document.addEventListener("click", onDocClick);
		window.addEventListener("theme-change", sync);
		const mq = window.matchMedia("(prefers-color-scheme: dark)");
		const onSys = () => {
			if (mode === SYSTEM_MODE) sync();
		};
		mq.addEventListener("change", onSys);
		return () => {
			document.removeEventListener("click", onDocClick);
			window.removeEventListener("theme-change", sync);
			mq.removeEventListener("change", onSys);
		};
	});
</script>

<div class="theme-switch">
	<button
		class="icon-btn"
		aria-label="切换主题"
		aria-haspopup="menu"
		aria-expanded={open}
		onclick={(e) => { e.stopPropagation(); toggle(); }}
	>
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="1.8"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true">{@html currentIcon()}</svg
		>
	</button>
	{#if open}
		<div class="dropdown open" role="menu">
			{#each OPTIONS as opt (opt.value)}
				<button
					class="dd-item"
					class:active={mode === opt.value}
					role="menuitem"
					onclick={(e) => { e.stopPropagation(); pick(opt.value); }}
				>
					<svg
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.8"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true">{@html ICONS[opt.icon]}</svg
					>
					{opt.label}
				</button>
			{/each}
		</div>
	{/if}
</div>

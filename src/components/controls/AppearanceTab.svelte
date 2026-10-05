<script lang="ts">
// DisplaySettingsIntegrated 的 appearance 标签页（组件拆分，UI/功能与拆分前完全一致）。
// 纯展示：状态/函数/片段全部由父组件传入；hue/hueTouched 需子组件内 bind，经 bind: 双向同步。
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import type { Snippet } from "svelte";

let {
	showThemeColor,
	hue = $bindable(),
	hueTouched = $bindable(),
	defaultHue,
	resetHue,
	allowLayoutSwitch,
	currentLayout,
	effectiveDefaultLayout,
	resetLayout,
	isSwitching,
	switchLayout,
	isCardBorderSwitchable,
	isCardFollowThemeSwitchable,
	cardSettingsIsDefault,
	resetCardSettings,
	cardBorderEnabled,
	cardFollowThemeEnabled,
	toggleCardBorderEnabled,
	toggleCardFollowThemeEnabled,
	resetButton,
	toggleRow,
}: {
	showThemeColor: boolean;
	hue: number;
	hueTouched: boolean;
	defaultHue: number;
	resetHue: () => void;
	allowLayoutSwitch: boolean;
	currentLayout: "list" | "grid";
	effectiveDefaultLayout: "list" | "grid";
	resetLayout: () => void;
	isSwitching: boolean;
	switchLayout: () => void;
	isCardBorderSwitchable: boolean;
	isCardFollowThemeSwitchable: boolean;
	cardSettingsIsDefault: boolean;
	resetCardSettings: () => void;
	cardBorderEnabled: boolean;
	cardFollowThemeEnabled: boolean;
	toggleCardBorderEnabled: () => void;
	toggleCardFollowThemeEnabled: () => void;
	resetButton: Snippet<[isDefault: boolean, onReset: () => void]>;
	toggleRow: Snippet<
		[icon: string, label: string, enabled: boolean, onToggle: () => void]
	>;
} = $props();
</script>

{#if showThemeColor}
<div class="">
	<div class="section-title">
		{i18n(I18nKey.themeColor)}
		{@render resetButton(hue === defaultHue, resetHue)}
		<div id="hueValue" class="transition bg-(--btn-regular-bg) rounded-md flex justify-center
				font-bold items-center text-(--btn-content)">
			{hue}
		</div>
	</div>
	<div class="hue-slider-shell w-full h-6 px-1 bg-[oklch(0.80_0.10_0)] dark:bg-[oklch(0.70_0.10_0)] rounded-md select-none">
		<input aria-label={i18n(I18nKey.themeColor)} type="range" min="0" max="360" bind:value={hue}
			   oninput={() => { hueTouched = true; }}
			   class="slider" id="colorSlider" step="5" style="width: 100%">
	</div>
</div>
{/if}

{#if allowLayoutSwitch}
<div class="">
	<div class="section-title">
		{i18n(I18nKey.postListLayout)}
		{@render resetButton(currentLayout === effectiveDefaultLayout, resetLayout)}
	</div>
	<div class="flex gap-2">
		<button
			aria-label={i18n(I18nKey.postListLayoutList)}
			class="flex-1 btn-regular rounded-md py-2 px-3 flex items-center justify-center gap-2 active:scale-95 transition-all relative overflow-hidden"
			class:opacity-60={currentLayout !== 'list'}
			class:bg-(--btn-regular-bg-hover)={currentLayout === 'list'}
			disabled={isSwitching}
			onclick={switchLayout}
			title={i18n(I18nKey.postListLayoutList)}
		>
			<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
				<path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z"/>
			</svg>
			<span class="text-xs font-medium">{i18n(I18nKey.postListLayoutList)}</span>
		</button>
		<button
			aria-label={i18n(I18nKey.postListLayoutGrid)}
			class="flex-1 btn-regular rounded-md py-2 px-3 flex items-center justify-center gap-2 active:scale-95 transition-all relative overflow-hidden"
			class:opacity-60={currentLayout !== 'grid'}
			class:bg-(--btn-regular-bg-hover)={currentLayout === 'grid'}
			disabled={isSwitching}
			onclick={switchLayout}
			title={i18n(I18nKey.postListLayoutGrid)}
		>
			<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
				<path d="M3 3h7v7H3V3zm0 11h7v7H3v-7zm11-11h7v7h-7V3zm0 11h7v7h-7v-7z"/>
			</svg>
			<span class="text-xs font-medium">{i18n(I18nKey.postListLayoutGrid)}</span>
		</button>
	</div>
</div>
{/if}

{#if isCardBorderSwitchable || isCardFollowThemeSwitchable}
<div>
	<div class="section-title">
		{i18n(I18nKey.cardSettings)}
		{@render resetButton(cardSettingsIsDefault, resetCardSettings)}
	</div>
	<div class="space-y-1">
		{#if isCardBorderSwitchable}
		{@render toggleRow("material-symbols:border-outer-rounded", i18n(I18nKey.cardBorder), cardBorderEnabled, toggleCardBorderEnabled)}
		{/if}
		{#if isCardFollowThemeSwitchable}
		{@render toggleRow("material-symbols:palette", i18n(I18nKey.cardFollowTheme), cardFollowThemeEnabled, toggleCardFollowThemeEnabled)}
		{/if}
	</div>
</div>
{/if}

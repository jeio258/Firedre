<script lang="ts">
// DisplaySettingsIntegrated 的 wallpaper 标签页（拆分自 914 行的上帝组件）。
// 纯展示：状态、派生值、切换/重置函数与 toggleRow/resetButton 片段全部由父组件
// 传入，本组件不含任何业务逻辑，避免行为漂移。
import {
	WALLPAPER_BANNER,
	WALLPAPER_FULLSCREEN,
	WALLPAPER_NONE,
	WALLPAPER_OVERLAY,
} from "@constants/constants";
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import type { Snippet } from "svelte";
import Icon from "@/components/common/Icon.svelte";
import type { WALLPAPER_MODE } from "@/types/config";

interface OverlaySliderItem {
	key: string;
	label: string;
	displayValue: string;
	min: number;
	max: number;
	step: number;
	value: number;
	enabled: boolean;
	ariaLabel: string;
	onValueChange: (v: number) => void;
}

let {
	isWallpaperSwitchable,
	wallpaperMode,
	defaultWallpaperMode,
	switchWallpaperMode,
	resetWallpaperMode,
	hasOverlaySettings,
	hasVisibleOverlaySlider,
	overlaySliderItems,
	overlaySettingsIsDefault,
	resetOverlaySettings,
	hasBannerSettings,
	isBannerTitleSwitchable,
	isBannerCarouselSwitchable,
	isWavesSwitchable,
	isGradientSwitchable,
	bannerTitleEnabled,
	bannerCarouselEnabled,
	wavesEnabled,
	gradientEnabled,
	bannerSettingsIsDefault,
	resetBannerSettings,
	toggleBannerTitleEnabled,
	toggleBannerCarouselEnabled,
	toggleWavesEnabled,
	toggleGradientEnabled,
	resetButton,
	toggleRow,
}: {
	isWallpaperSwitchable: boolean;
	wallpaperMode: WALLPAPER_MODE;
	defaultWallpaperMode: WALLPAPER_MODE;
	switchWallpaperMode: (mode: WALLPAPER_MODE) => void;
	resetWallpaperMode: () => void;
	hasOverlaySettings: boolean;
	hasVisibleOverlaySlider: boolean;
	overlaySliderItems: OverlaySliderItem[];
	overlaySettingsIsDefault: boolean;
	resetOverlaySettings: () => void;
	hasBannerSettings: boolean;
	isBannerTitleSwitchable: boolean;
	isBannerCarouselSwitchable: boolean;
	isWavesSwitchable: boolean;
	isGradientSwitchable: boolean;
	bannerTitleEnabled: boolean;
	bannerCarouselEnabled: boolean;
	wavesEnabled: boolean;
	gradientEnabled: boolean;
	bannerSettingsIsDefault: boolean;
	resetBannerSettings: () => void;
	toggleBannerTitleEnabled: () => void;
	toggleBannerCarouselEnabled: () => void;
	toggleWavesEnabled: () => void;
	toggleGradientEnabled: () => void;
	resetButton: Snippet<[isDefault: boolean, onReset: () => void]>;
	toggleRow: Snippet<
		[icon: string, label: string, enabled: boolean, onToggle: () => void]
	>;
} = $props();
</script>

{#if isWallpaperSwitchable}
<div>
	<div class="section-title">
		{i18n(I18nKey.wallpaperMode)}
		{@render resetButton(wallpaperMode === defaultWallpaperMode, resetWallpaperMode)}
	</div>
	<div class="grid grid-cols-2 gap-2">
		<button
			class="btn-regular rounded-md py-2 px-3 flex items-center justify-center gap-2 active:scale-95 transition-all relative overflow-hidden"
			class:opacity-60={wallpaperMode !== WALLPAPER_BANNER}
			class:bg-(--btn-regular-bg-hover)={wallpaperMode === WALLPAPER_BANNER}
			onclick={() => switchWallpaperMode(WALLPAPER_BANNER)}
		>
			<Icon icon="material-symbols:image-outline" class="text-[1.25rem] shrink-0"></Icon>
			<span class="text-xs font-medium">{i18n(I18nKey.wallpaperBannerMode)}</span>
		</button>
		<button
			class="btn-regular rounded-md py-2 px-3 flex items-center justify-center gap-2 active:scale-95 transition-all relative overflow-hidden"
			class:opacity-60={wallpaperMode !== WALLPAPER_FULLSCREEN}
			class:bg-(--btn-regular-bg-hover)={wallpaperMode === WALLPAPER_FULLSCREEN}
			onclick={() => switchWallpaperMode(WALLPAPER_FULLSCREEN)}
		>
			<Icon icon="material-symbols:wallpaper" class="text-[1.25rem] shrink-0"></Icon>
			<span class="text-xs font-medium">{i18n(I18nKey.wallpaperFullscreenMode)}</span>
		</button>
		<button
			class="btn-regular rounded-md py-2 px-3 flex items-center justify-center gap-2 active:scale-95 transition-all relative overflow-hidden"
			class:opacity-60={wallpaperMode !== WALLPAPER_OVERLAY}
			class:bg-(--btn-regular-bg-hover)={wallpaperMode === WALLPAPER_OVERLAY}
			onclick={() => switchWallpaperMode(WALLPAPER_OVERLAY)}
		>
			<Icon icon="material-symbols:full-coverage-outline-rounded" class="text-[1.25rem] shrink-0"></Icon>
			<span class="text-xs font-medium">{i18n(I18nKey.wallpaperOverlayMode)}</span>
		</button>
		<button
			class="btn-regular rounded-md py-2 px-3 flex items-center justify-center gap-2 active:scale-95 transition-all relative overflow-hidden"
			class:opacity-60={wallpaperMode !== WALLPAPER_NONE}
			class:bg-(--btn-regular-bg-hover)={wallpaperMode === WALLPAPER_NONE}
			onclick={() => switchWallpaperMode(WALLPAPER_NONE)}
		>
			<Icon icon="material-symbols:hide-image-outline" class="text-[1.25rem] shrink-0"></Icon>
			<span class="text-xs font-medium">{i18n(I18nKey.wallpaperNoneMode)}</span>
		</button>
	</div>
</div>
{/if}

<!-- Overlay Settings Section（全屏壁纸模式也复用 overlay 的透明/模糊/卡片透明度设置） -->
{#if (wallpaperMode === WALLPAPER_OVERLAY || wallpaperMode === WALLPAPER_FULLSCREEN) && hasOverlaySettings && hasVisibleOverlaySlider}
<div class="">
	<div class="section-title">
		{i18n(I18nKey.overlaySettings)}
		{@render resetButton(overlaySettingsIsDefault, resetOverlaySettings)}
	</div>
	<div class="space-y-2">
		{#each overlaySliderItems as item (item.key)}
			{#if item.enabled}
				<div class="rounded-md bg-(--btn-regular-bg) p-2">
					<div class="flex items-center justify-between mb-1">
						<span class="text-xs font-medium text-(--btn-content) opacity-80">{item.label}</span>
						<span class="text-xs text-(--btn-content)">{item.displayValue}</span>
					</div>
					<input
						aria-label={item.ariaLabel}
						type="range"
						min={item.min}
						max={item.max}
						step={item.step}
						value={item.value}
						oninput={(e) => item.onValueChange(Number((e.currentTarget as HTMLInputElement).value))}
						class="slider w-full overlay-slider"
					/>
				</div>
			{/if}
		{/each}
	</div>
</div>
{/if}

{#if (wallpaperMode === WALLPAPER_BANNER || wallpaperMode === WALLPAPER_FULLSCREEN) && hasBannerSettings}
<div class="">
	<div class="section-title">
		{i18n(I18nKey.wallpaperSettings)}
		{@render resetButton(bannerSettingsIsDefault, resetBannerSettings)}
	</div>
	<div class="space-y-1">

		{#if isBannerTitleSwitchable}
		{@render toggleRow("material-symbols:titlecase-rounded", i18n(I18nKey.wallpaperTitle), bannerTitleEnabled, toggleBannerTitleEnabled)}
		{/if}
		{#if isBannerCarouselSwitchable}
		{@render toggleRow("material-symbols:view-carousel-outline", i18n(I18nKey.wallpaperCarousel), bannerCarouselEnabled, toggleBannerCarouselEnabled)}
		{/if}
		<!-- Waves Animation Switch（仅横幅模式，全屏壁纸无水波纹） -->
		{#if isWavesSwitchable && wallpaperMode === WALLPAPER_BANNER}
		{@render toggleRow("material-symbols:airwave-rounded", i18n(I18nKey.wavesAnimation), wavesEnabled, toggleWavesEnabled)}
		{/if}
		<!-- Gradient Transition Switch（仅横幅模式，全屏壁纸无渐变过渡） -->
		{#if isGradientSwitchable && wallpaperMode === WALLPAPER_BANNER}
		{@render toggleRow("material-symbols:gradient", i18n(I18nKey.gradientTransition), gradientEnabled, toggleGradientEnabled)}
		{/if}
	</div>
</div>
{/if}

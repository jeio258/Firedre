<script lang="ts">
import {
	WALLPAPER_BANNER,
	WALLPAPER_FULLSCREEN,
	WALLPAPER_NONE,
	WALLPAPER_OVERLAY,
} from "@constants/constants";
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import type { SettingsView } from "@server/settings/service";
import {
	BREAKPOINT_COMPACT,
	BREAKPOINT_TABLET,
	BREAKPOINT_WIDE,
} from "@utils/breakpoints";
import {
	getDefaultBannerCarouselEnabled,
	getDefaultBannerTitleEnabled,
	getDefaultCardBorderEnabled,
	getDefaultCardFollowThemeEnabled,
	getDefaultGradientEnabled,
	getDefaultHue,
	getDefaultOverlayBlur,
	getDefaultOverlayCardOpacity,
	getDefaultOverlayOpacity,
	getDefaultSakuraEnabled,
	getDefaultWavesEnabled,
	getHue,
	getStoredBannerCarouselEnabled,
	getStoredBannerTitleEnabled,
	getStoredCardBorderEnabled,
	getStoredCardFollowThemeEnabled,
	getStoredGradientEnabled,
	getStoredOverlayBlur,
	getStoredOverlayCardOpacity,
	getStoredOverlayOpacity,
	getStoredSakuraEnabled,
	getStoredWallpaperMode,
	getStoredWavesEnabled,
	setBannerCarouselEnabled,
	setBannerTitleEnabled,
	setCardBorderEnabled,
	setCardFollowThemeEnabled,
	setGradientEnabled,
	setHue,
	setOverlayBlur,
	setOverlayCardOpacity,
	setOverlayOpacity,
	setSakuraEnabled,
	setWallpaperMode,
	setWavesEnabled,
} from "@utils/setting-utils";
import { onMount } from "svelte";
import Icon from "@/components/common/Icon.svelte";
import {
	backgroundWallpaper,
	displaySettingsConfig,
	siteConfig,
} from "@/config";
import { getPanelConfig, getWallpaperConfig } from "@/config/runtime";
import type { WALLPAPER_MODE } from "@/types/config";

type OverlaySliderItem = {
	key: "opacity" | "blur" | "cardOpacity";
	enabled: boolean;
	label: string;
	displayValue: string;
	ariaLabel: string;
	min: number;
	max: number;
	step: number;
	value: number;
	onValueChange: (value: number) => void;
};

type TabKey = "appearance" | "wallpaper" | "effects";

let { settings: _settingsProp = {} as SettingsView } = $props();
// D1 组值优先（SSR 注入 prop），回退窗口注入值；形状由 SettingsView 描述
const settings: SettingsView =
	_settingsProp &&
	typeof _settingsProp === "object" &&
	Object.keys(_settingsProp).length > 0
		? _settingsProp
		: ((typeof window !== "undefined"
				? window.__FIREFLY_SETTINGS__
				: undefined) ?? {});
// 后台可编辑项统一走 runtime 收敛入口（内部含静态兜底与类型归一）
const panelView = getPanelConfig({ settings });
const wallpaperView = getWallpaperConfig({ settings });
// overlaySwitchable 在静态配置中为嵌套对象（getPanelConfig 无对应扁平兜底），此处保留本组件兜底
const panelFlag = (k: string, fallback: boolean) => {
	const v = settings.panel?.[k];
	return typeof v === "boolean" ? v : fallback;
};

let hue = $state(getHue());
const defaultHue = getDefaultHue();
let wallpaperMode: WALLPAPER_MODE = $state(wallpaperView.mode);
const defaultWallpaperMode = wallpaperView.mode;
let currentLayout: "list" | "grid" = $state("list");
const defaultLayout = siteConfig.postListLayout.defaultMode;
const mobileDefaultLayout =
	siteConfig.postListLayout.mobileDefaultMode || defaultLayout;
let mounted = $state(false);
let isSmallScreen = $state(
	typeof window !== "undefined" ? window.innerWidth < BREAKPOINT_WIDE : false,
);
// 780 为面板/列表默认布局的移动阈值（is:inline 脚本同用，暂未收敛进断点模块）
let isMobileWidth = $state(
	typeof window !== "undefined" ? window.innerWidth < 780 : false,
);
let isMobileViewport = $state(
	typeof window !== "undefined" ? window.innerWidth < BREAKPOINT_TABLET : false,
);
let isSwitching = $state(false);
let wavesEnabled = $state(true);
const defaultWavesEnabled = getDefaultWavesEnabled();
let gradientEnabled = $state(true);
const defaultGradientEnabled = getDefaultGradientEnabled();
let bannerTitleEnabled = $state(true);
const defaultBannerTitleEnabled = getDefaultBannerTitleEnabled();
let bannerCarouselEnabled = $state(true);
const defaultBannerCarouselEnabled = getDefaultBannerCarouselEnabled();
let sakuraEnabled = $state(true);
const defaultSakuraEnabled = getDefaultSakuraEnabled();
let overlayOpacity = $state(getDefaultOverlayOpacity());
const defaultOverlayOpacity = getDefaultOverlayOpacity();
let overlayBlur = $state(getDefaultOverlayBlur());
const defaultOverlayBlur = getDefaultOverlayBlur();
let overlayCardOpacity = $state(getDefaultOverlayCardOpacity());
const defaultOverlayCardOpacity = getDefaultOverlayCardOpacity();
let cardBorderEnabled = $state(false);
const defaultCardBorderEnabled = getDefaultCardBorderEnabled();
let cardFollowThemeEnabled = $state(false);
const defaultCardFollowThemeEnabled = getDefaultCardFollowThemeEnabled();

const isWallpaperSwitchable = panelView.wallpaperModeSwitchable;
const allowLayoutSwitch = panelView.layoutSwitchable;
let effectiveDefaultLayout = $derived(
	isMobileWidth ? mobileDefaultLayout : defaultLayout,
);
const showThemeColor = panelView.themeColorSwitchable;
const isWavesSwitchable = panelView.wavesSwitchable;
const isGradientSwitchable = panelView.gradientSwitchable;
// 检查是否启用横幅标题配置（功能开关，非用户切换开关）
const isBannerTitleEnabled = wallpaperView.common?.homeText?.enable ?? false;
const isBannerTitleSwitchable =
	isBannerTitleEnabled && panelView.bannerTitleSwitchable;
const isBannerCarouselSwitchable = panelView.bannerCarouselSwitchable;
const isSakuraSwitchable = panelView.sakuraSwitchable;
const isCardBorderSwitchable = panelView.cardBorderSwitchable;
const isCardFollowThemeSwitchable = panelView.cardFollowThemeSwitchable;
// 是否有任何横幅设置可显示（后续添加新设置时在此处添加条件）
const hasBannerSettings =
	isWavesSwitchable ||
	isGradientSwitchable ||
	isBannerTitleSwitchable ||
	isBannerCarouselSwitchable;
const overlaySwitchableConfig = displaySettingsConfig.overlaySwitchable;
const overlaySwitchableObj =
	typeof overlaySwitchableConfig === "object" &&
	overlaySwitchableConfig !== null
		? overlaySwitchableConfig
		: {};

const isOverlaySettingsSwitchable = panelFlag(
	"overlayOpacitySwitchable",
	overlaySwitchableObj.opacity ?? overlaySwitchableConfig === true,
);
const isOverlayOpacitySwitchable = panelFlag(
	"overlayOpacitySwitchable",
	overlaySwitchableObj.opacity ?? false,
);
const isOverlayBlurSwitchable = panelFlag(
	"overlayBlurSwitchable",
	overlaySwitchableObj.blur ?? false,
);
const isOverlayCardOpacitySwitchable = panelFlag(
	"overlayCardOpacitySwitchable",
	overlaySwitchableObj.cardOpacity ?? false,
);
const hasOverlaySettings =
	isOverlaySettingsSwitchable &&
	(isOverlayOpacitySwitchable ||
		isOverlayBlurSwitchable ||
		isOverlayCardOpacitySwitchable);

const isFullscreenBlurRampEnabled = $derived.by(() => {
	const enable = backgroundWallpaper.fullscreen?.blurRamp?.enable;
	if (typeof enable === "boolean") return enable;
	if (!enable) return true;
	return isMobileViewport ? enable.mobile : enable.desktop;
});
let overlaySettingsIsDefault = $derived(
	(!isOverlayOpacitySwitchable || overlayOpacity === defaultOverlayOpacity) &&
		(!isOverlayBlurSwitchable || overlayBlur === defaultOverlayBlur) &&
		(!isOverlayCardOpacitySwitchable ||
			overlayCardOpacity === defaultOverlayCardOpacity),
);
// 横幅设置是否全部为默认值（用于控制恢复默认按钮的显隐）
let bannerSettingsIsDefault = $derived(
	(!isBannerTitleSwitchable ||
		bannerTitleEnabled === defaultBannerTitleEnabled) &&
		(!isWavesSwitchable || wavesEnabled === defaultWavesEnabled) &&
		(!isGradientSwitchable || gradientEnabled === defaultGradientEnabled) &&
		(!isBannerCarouselSwitchable ||
			bannerCarouselEnabled === defaultBannerCarouselEnabled),
);
let cardSettingsIsDefault = $derived(
	(!isCardBorderSwitchable || cardBorderEnabled === defaultCardBorderEnabled) &&
		(!isCardFollowThemeSwitchable ||
			cardFollowThemeEnabled === defaultCardFollowThemeEnabled),
);
const isPanelEnabled = panelView.enable;
const hasAnyContent =
	isPanelEnabled &&
	(showThemeColor ||
		isWallpaperSwitchable ||
		allowLayoutSwitch ||
		hasBannerSettings ||
		hasOverlaySettings ||
		isSakuraSwitchable);

const hasAppearanceTab = $derived(
	showThemeColor ||
		allowLayoutSwitch ||
		isCardBorderSwitchable ||
		isCardFollowThemeSwitchable,
);
const hasWallpaperTab = $derived(
	isWallpaperSwitchable ||
		((wallpaperMode === WALLPAPER_OVERLAY ||
			wallpaperMode === WALLPAPER_FULLSCREEN) &&
			hasOverlaySettings) ||
		((wallpaperMode === WALLPAPER_BANNER ||
			wallpaperMode === WALLPAPER_FULLSCREEN) &&
			hasBannerSettings),
);
const hasEffectsTab = $derived(isSakuraSwitchable);

let visibleTabs = $derived.by(() => {
	const tabs: { key: TabKey; icon: string; label: string }[] = [];
	if (hasAppearanceTab)
		tabs.push({
			key: "appearance",
			icon: "material-symbols:palette",
			label: i18n(I18nKey.settingsTabAppearance),
		});
	if (hasWallpaperTab)
		tabs.push({
			key: "wallpaper",
			icon: "material-symbols:wallpaper",
			label: i18n(I18nKey.settingsTabWallpaper),
		});
	if (hasEffectsTab)
		tabs.push({
			key: "effects",
			icon: "mdi:flower-poppy",
			label: i18n(I18nKey.settingsTabEffects),
		});
	return tabs;
});

let showTabBar = $derived(visibleTabs.length > 1);
let activeTab = $state<TabKey>("appearance");

$effect(() => {
	if (!visibleTabs.find((t) => t.key === activeTab) && visibleTabs.length > 0) {
		activeTab = visibleTabs[0].key;
	}
});

// 进入 overlay/fullscreen 模式时自动切到壁纸页
$effect(() => {
	if (
		(wallpaperMode === WALLPAPER_OVERLAY ||
			wallpaperMode === WALLPAPER_FULLSCREEN) &&
		hasOverlaySettings
	) {
		activeTab = "wallpaper";
	}
});

let overlaySliderItems = $derived<OverlaySliderItem[]>([
	{
		key: "opacity",
		// 全屏壁纸模式不需要背景透明度，隐藏该滑块（仍显示模糊与卡片透明度）
		enabled:
			isOverlayOpacitySwitchable && wallpaperMode !== WALLPAPER_FULLSCREEN,
		label: i18n(I18nKey.overlayOpacity),
		displayValue: `${Math.round(overlayOpacity * 100)}%`,
		ariaLabel: i18n(I18nKey.overlayOpacity),
		min: 20,
		max: 100,
		step: 1,
		value: Math.round(overlayOpacity * 100),
		onValueChange: (value) => {
			overlayOpacity = value / 100;
		},
	},
	{
		key: "blur",
		// 全屏壁纸模式关闭模糊渐变时隐藏模糊滑块（overlay 模式不受影响）
		enabled:
			isOverlayBlurSwitchable &&
			!(wallpaperMode === WALLPAPER_FULLSCREEN && !isFullscreenBlurRampEnabled),
		label: i18n(I18nKey.overlayBlur),
		displayValue: `${overlayBlur.toFixed(1)}px`,
		ariaLabel: i18n(I18nKey.overlayBlur),
		min: 0,
		max: 20,
		step: 0.5,
		value: overlayBlur,
		onValueChange: (value) => {
			overlayBlur = value;
		},
	},
	{
		key: "cardOpacity",
		enabled: isOverlayCardOpacitySwitchable,
		label: i18n(I18nKey.overlayCardOpacity),
		displayValue: `${Math.round(overlayCardOpacity * 100)}%`,
		ariaLabel: i18n(I18nKey.overlayCardOpacity),
		min: 20,
		max: 100,
		step: 1,
		value: Math.round(overlayCardOpacity * 100),
		onValueChange: (value) => {
			overlayCardOpacity = value / 100;
		},
	},
]);

let hasVisibleOverlaySlider = $derived(
	overlaySliderItems.some((item) => item.enabled),
);

function resetHue() {
	hue = getDefaultHue();
	requestAnimationFrame(refreshAllRangeProgress);
}

function resetWallpaperMode() {
	wallpaperMode = defaultWallpaperMode;
	setWallpaperMode(defaultWallpaperMode);
}

function resetLayout() {
	currentLayout = effectiveDefaultLayout;
	localStorage.removeItem("postListLayout");

	// 触发自定义事件，通知页面布局已改变
	const event = new CustomEvent("layoutChange", {
		detail: { layout: effectiveDefaultLayout },
	});
	window.dispatchEvent(event);
}

function resetWavesEnabled() {
	wavesEnabled = defaultWavesEnabled;
	setWavesEnabled(defaultWavesEnabled);
}

function resetGradientEnabled() {
	gradientEnabled = defaultGradientEnabled;
	setGradientEnabled(defaultGradientEnabled);
}

function resetBannerSettings() {
	if (
		isBannerTitleSwitchable &&
		bannerTitleEnabled !== defaultBannerTitleEnabled
	) {
		bannerTitleEnabled = defaultBannerTitleEnabled;
		setBannerTitleEnabled(defaultBannerTitleEnabled);
	}
	if (isWavesSwitchable && wavesEnabled !== defaultWavesEnabled) {
		wavesEnabled = defaultWavesEnabled;
		setWavesEnabled(defaultWavesEnabled);
	}
	if (isGradientSwitchable && gradientEnabled !== defaultGradientEnabled) {
		gradientEnabled = defaultGradientEnabled;
		setGradientEnabled(defaultGradientEnabled);
	}
	if (
		isBannerCarouselSwitchable &&
		bannerCarouselEnabled !== defaultBannerCarouselEnabled
	) {
		bannerCarouselEnabled = defaultBannerCarouselEnabled;
		setBannerCarouselEnabled(defaultBannerCarouselEnabled);
	}
}

function resetOverlaySettings() {
	if (isOverlayOpacitySwitchable && overlayOpacity !== defaultOverlayOpacity) {
		overlayOpacity = defaultOverlayOpacity;
		setOverlayOpacity(defaultOverlayOpacity);
	}
	if (isOverlayBlurSwitchable && overlayBlur !== defaultOverlayBlur) {
		overlayBlur = defaultOverlayBlur;
		setOverlayBlur(defaultOverlayBlur);
	}
	if (
		isOverlayCardOpacitySwitchable &&
		overlayCardOpacity !== defaultOverlayCardOpacity
	) {
		overlayCardOpacity = defaultOverlayCardOpacity;
		setOverlayCardOpacity(defaultOverlayCardOpacity);
	}

	requestAnimationFrame(refreshAllRangeProgress);
}

function toggleWavesEnabled() {
	wavesEnabled = !wavesEnabled;
	setWavesEnabled(wavesEnabled);
}

function toggleGradientEnabled() {
	gradientEnabled = !gradientEnabled;
	setGradientEnabled(gradientEnabled);
}

function toggleBannerTitleEnabled() {
	bannerTitleEnabled = !bannerTitleEnabled;
	setBannerTitleEnabled(bannerTitleEnabled);
}

function toggleBannerCarouselEnabled() {
	bannerCarouselEnabled = !bannerCarouselEnabled;
	setBannerCarouselEnabled(bannerCarouselEnabled);
}

function toggleSakuraEnabled() {
	sakuraEnabled = !sakuraEnabled;
	setSakuraEnabled(sakuraEnabled);
}

function toggleCardBorderEnabled() {
	cardBorderEnabled = !cardBorderEnabled;
	setCardBorderEnabled(cardBorderEnabled);
}

function toggleCardFollowThemeEnabled() {
	cardFollowThemeEnabled = !cardFollowThemeEnabled;
	setCardFollowThemeEnabled(cardFollowThemeEnabled);
}

function resetCardSettings() {
	if (
		isCardBorderSwitchable &&
		cardBorderEnabled !== defaultCardBorderEnabled
	) {
		cardBorderEnabled = defaultCardBorderEnabled;
		setCardBorderEnabled(defaultCardBorderEnabled);
	}
	if (
		isCardFollowThemeSwitchable &&
		cardFollowThemeEnabled !== defaultCardFollowThemeEnabled
	) {
		cardFollowThemeEnabled = defaultCardFollowThemeEnabled;
		setCardFollowThemeEnabled(defaultCardFollowThemeEnabled);
	}
}

function switchWallpaperMode(newMode: WALLPAPER_MODE) {
	wallpaperMode = newMode;
	setWallpaperMode(newMode);
	window.scrollTo({ top: 0 });

	if (newMode === WALLPAPER_OVERLAY || newMode === WALLPAPER_FULLSCREEN) {
		requestAnimationFrame(refreshAllRangeProgress);
	}
}

function checkScreenSize() {
	isSmallScreen = window.innerWidth < BREAKPOINT_WIDE;
	isMobileWidth = window.innerWidth < 780;
	isMobileViewport = window.innerWidth < BREAKPOINT_TABLET;
	// 低于380px强制网格模式
	if (window.innerWidth < BREAKPOINT_COMPACT && currentLayout === "list") {
		currentLayout = "grid";
		const event = new CustomEvent("layoutChange", {
			detail: { layout: "grid" },
		});
		window.dispatchEvent(event);
	}
}

function updateRangeProgress(input: HTMLInputElement) {
	const min = Number(input.min || 0);
	const max = Number(input.max || 100);
	const value = Number(input.value || 0);
	const progress = ((value - min) * 100) / (max - min || 1);
	input.style.setProperty(
		"--range-progress",
		`${Math.min(100, Math.max(0, progress))}%`,
	);
}

function refreshAllRangeProgress() {
	const panel = document.getElementById("display-setting");
	if (!panel) return;

	const rangeInputs = Array.from(
		panel.querySelectorAll('input[type="range"]'),
	) as HTMLInputElement[];

	rangeInputs.forEach((input) => {
		updateRangeProgress(input);
	});
}

function switchLayout() {
	if (!mounted || isSwitching) return;

	isSwitching = true;
	currentLayout = currentLayout === "list" ? "grid" : "list";
	localStorage.setItem("postListLayout", currentLayout);

	// 触发自定义事件，通知页面布局已改变
	const event = new CustomEvent("layoutChange", {
		detail: { layout: currentLayout },
	});
	window.dispatchEvent(event);

	// 动画完成后重置状态
	setTimeout(() => {
		isSwitching = false;
	}, 500);
}

onMount(() => {
	mounted = true;
	checkScreenSize();

	wallpaperMode = getStoredWallpaperMode();

	wavesEnabled = getStoredWavesEnabled();

	gradientEnabled = getStoredGradientEnabled();

	bannerTitleEnabled = getStoredBannerTitleEnabled();

	bannerCarouselEnabled = getStoredBannerCarouselEnabled();

	sakuraEnabled = getStoredSakuraEnabled();

	cardBorderEnabled = getStoredCardBorderEnabled();
	cardFollowThemeEnabled = getStoredCardFollowThemeEnabled();

	overlayOpacity = getStoredOverlayOpacity();
	overlayBlur = getStoredOverlayBlur();
	overlayCardOpacity = getStoredOverlayCardOpacity();

	const savedLayout = localStorage.getItem("postListLayout");
	if (savedLayout && (savedLayout === "list" || savedLayout === "grid")) {
		currentLayout = savedLayout;
	} else {
		currentLayout =
			window.innerWidth < 780 ? mobileDefaultLayout : defaultLayout;
	}

	// resize 高频触发，rAF 合帧避免连续重算布局状态
	let resizeRaf = 0;
	const onResize = () => {
		if (resizeRaf) return;
		resizeRaf = requestAnimationFrame(() => {
			resizeRaf = 0;
			checkScreenSize();
		});
	};
	window.addEventListener("resize", onResize);

	return () => {
		window.removeEventListener("resize", onResize);
		if (resizeRaf) cancelAnimationFrame(resizeRaf);
	};
});

onMount(() => {
	const handleCustomEvent = (event: Event) => {
		const customEvent = event as CustomEvent<{ layout: "list" | "grid" }>;
		currentLayout = customEvent.detail.layout;
	};

	window.addEventListener("layoutChange", handleCustomEvent);

	return () => {
		window.removeEventListener("layoutChange", handleCustomEvent);
	};
});

onMount(() => {
	const panel = document.getElementById("display-setting");
	if (!panel) return;

	const handleRangeInput = (event: Event) => {
		const target = event.target;
		if (target instanceof HTMLInputElement && target.type === "range") {
			updateRangeProgress(target);
		}
	};

	refreshAllRangeProgress();
	panel.addEventListener("input", handleRangeInput);

	return () => {
		panel.removeEventListener("input", handleRangeInput);
	};
});

onMount(() => {
	const handleWallpaperModeChange = (event: Event) => {
		const customEvent = event as CustomEvent<{ mode: WALLPAPER_MODE }>;
		wallpaperMode = customEvent.detail.mode;
	};

	window.addEventListener("wallpaperModeChange", handleWallpaperModeChange);

	return () => {
		window.removeEventListener(
			"wallpaperModeChange",
			handleWallpaperModeChange,
		);
	};
});

$effect(() => {
	if (hue || hue === 0) {
		setHue(hue);
	}
});

$effect(() => {
	if (wallpaperMode === WALLPAPER_OVERLAY) {
		if (isOverlayOpacitySwitchable) {
			setOverlayOpacity(overlayOpacity);
		}
		if (isOverlayBlurSwitchable) {
			setOverlayBlur(overlayBlur);
		}
		if (isOverlayCardOpacitySwitchable) {
			setOverlayCardOpacity(overlayCardOpacity);
		}
	} else if (wallpaperMode === WALLPAPER_FULLSCREEN) {
		// 全屏壁纸不透明，只应用模糊与卡片透明度
		if (isOverlayBlurSwitchable) {
			setOverlayBlur(overlayBlur);
		}
		if (isOverlayCardOpacitySwitchable) {
			setOverlayCardOpacity(overlayCardOpacity);
		}
	}
});

// Tab 切换后刷新滑块进度（overlay 滑块在 DOM 中才生效）
$effect(() => {
	activeTab;
	requestAnimationFrame(refreshAllRangeProgress);
});
</script>

<div id="display-setting" class="float-panel float-panel-closed absolute transition-all w-80 right-4 px-3 pt-0 pb-3 max-h-[80vh] overflow-y-auto {hasAnyContent ? '' : 'hidden!'}" data-floating-panel data-floating-panel-trigger="display-settings-switch" inert aria-hidden="true">
	{#snippet resetButton(isDefault: boolean, onReset: () => void)}
<button aria-label="Reset to Default" class="btn-regular rounded-md active:scale-90"
		class:opacity-0={isDefault} class:pointer-events-none={isDefault}
		disabled={isDefault} aria-hidden={isDefault ? "true" : undefined} onclick={onReset}>
	<div class="text-(--btn-content)">
		<Icon icon="fa7-solid:arrow-rotate-left" class="text-[0.75rem]"></Icon>
	</div>
</button>
{/snippet}

{#snippet toggleRow(icon: string, label: string, enabled: boolean, onToggle: () => void)}
<button
	class="w-full btn-regular rounded-md py-2 px-3 flex items-center gap-3 text-left active:scale-95 transition-all relative overflow-hidden"
	class:bg-(--btn-regular-bg-hover)={enabled}
	onclick={onToggle}
>
	<Icon icon={icon} class="text-[1.25rem] shrink-0"></Icon>
	<span class="text-sm flex-1">{label}</span>
	<div class="w-10 h-5 rounded-full transition-all duration-200 relative"
		 class:bg-(--primary)={enabled}
		 class:bg-(--btn-regular-bg-active)={!enabled}>
		<div class="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all duration-200"
			 class:left-0.5={!enabled}
			 class:left-5={enabled}></div>
	</div>
</button>
{/snippet}

{#if hasAnyContent}

	{#if showTabBar}
	<div class="flex border-b border-black/5 dark:border-white/10 -mx-1 mb-2">
		{#each visibleTabs as tab (tab.key)}
			<button
				class="focus-ring-inset flex-1 flex items-center justify-center gap-1 py-2 text-xs font-medium transition-colors relative min-w-0 rounded-md
					{activeTab === tab.key ? 'text-(--primary)' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}"
				onclick={() => activeTab = tab.key}
			>
				<Icon icon={tab.icon} class="text-[0.875rem] shrink-0"></Icon>
				<span class="truncate">{tab.label}</span>
				{#if activeTab === tab.key}
					<div class="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-(--primary)"></div>
				{/if}
			</button>
		{/each}
	</div>
	{/if}

	{#if activeTab === "appearance"}
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
	{/if}

	{#if activeTab === "wallpaper"}

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
	{/if}

	{#if activeTab === "effects"}
		{#if isSakuraSwitchable}
		<div class="">
			<div class="section-title">
				{i18n(I18nKey.effectsSettings)}
				{@render resetButton(sakuraEnabled === defaultSakuraEnabled, () => { sakuraEnabled = defaultSakuraEnabled; setSakuraEnabled(defaultSakuraEnabled); })}
			</div>
			{@render toggleRow("mdi:flower-poppy", i18n(I18nKey.sakuraEffect), sakuraEnabled, toggleSakuraEnabled)}
		</div>
		{/if}
	{/if}
	{/if}
</div>

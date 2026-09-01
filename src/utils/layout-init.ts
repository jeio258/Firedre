import {
	registerContentOverflowListeners,
	scheduleContentOverflowEnhancements,
} from "@/utils/content-overflow-utils";
import {
	initializeFloatingPanels,
	setClickOutsideToClose,
} from "@/utils/floating-panel-utils";
import {
	initFullscreenWallpaper,
	syncFullscreenStateAfterInit,
} from "@/utils/fullscreen-wallpaper-utils";
import {
	refreshSidebarStickyState,
	updateMainGridCols,
	updateSidebarComponentsVisibility,
} from "@/utils/grid-layout-utils";
import { initIconLoader } from "@/utils/icon-loader";
import { initImageLoadFadeIn } from "@/utils/lqip-utils";
import { initScroll } from "@/utils/scroll-utils";
import { initThemeListener, initWallpaperMode } from "@/utils/setting-utils";
import { setupSwupTransitions } from "@/utils/swup-transitions";
import { initTouchCodeCopyReveal } from "@/utils/touch-copy-utils";

export function initLayout(): void {

	if (window.__fireflyLayoutInit) return;
	window.__fireflyLayoutInit = true;

	initializeFloatingPanels();

	setClickOutsideToClose("display-setting", [
		"display-setting",
		"display-settings-switch",
	]);
	setClickOutsideToClose("nav-menu-panel", [
		"nav-menu-panel",
		"nav-menu-switch",
	]);
	setClickOutsideToClose("search-panel", [
		"search-panel",
		"search-bar",
		"search-switch",
	]);
	setClickOutsideToClose("wallpaper-mode-panel", [
		"wallpaper-mode-panel",
		"wallpaper-mode-switch",
	]);
	setClickOutsideToClose("theme-mode-panel", [
		"theme-mode-panel",
		"scheme-switch",
	]);

	setupSwupTransitions();
	initFullscreenWallpaper();
	registerContentOverflowListeners();
	// 滚动路径不再读取布局；先在初始化时填充侧边栏 top 容器可见性缓存
	refreshSidebarStickyState();
	initScroll();
	initTouchCodeCopyReveal();

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", () => {
			scheduleContentOverflowEnhancements();
		});
	} else {
		scheduleContentOverflowEnhancements();
	}

	// Initialize wallpaper mode
	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", () => {
			updateMainGridCols();
			updateSidebarComponentsVisibility();
			initWallpaperMode();
			initThemeListener();
			initIconLoader();
			syncFullscreenStateAfterInit();
		});
	} else {
		updateMainGridCols();
		updateSidebarComponentsVisibility();
		initWallpaperMode();
		initThemeListener();
		initIconLoader();
		syncFullscreenStateAfterInit();
	}

	initImageLoadFadeIn();

	document.addEventListener("astro:page-load", () => {
		requestAnimationFrame(initImageLoadFadeIn);
	});
	document.addEventListener("swup:contentReplaced", () => {
		requestAnimationFrame(initImageLoadFadeIn);
	});
}

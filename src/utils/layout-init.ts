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

/**
 * H3：壁纸图片加载失败的深色兜底。
 * 捕获态委托挂在 #wallpaper-wrapper 上，覆盖 banner/fullscreen/overlay 全部图片
 * （含模板动态克隆、SSR 直出）；error 事件不冒泡，必须用 capture。
 * 初始化时同步扫描已失败的图（error 可能在 JS 挂监听前就已触发）。
 */
function bindWallpaperErrorFallback(): void {
	const wrapper = document.getElementById("wallpaper-wrapper");
	if (!wrapper) return;
	const mark = () => wrapper.setAttribute("data-wallpaper-error", "1");
	wrapper.addEventListener(
		"error",
		(event) => {
			const t = event.target as HTMLElement | null;
			if (t && t.tagName === "IMG") mark();
		},
		true,
	);
	wrapper.querySelectorAll("img").forEach((img) => {
		if (img.complete && img.naturalWidth === 0) mark();
	});
}

export function initLayout(): void {
	if (window.__fireflyLayoutInit) return;
	window.__fireflyLayoutInit = true;

	initializeFloatingPanels();
	bindWallpaperErrorFallback();

	// display-setting / nav-menu-panel / theme-mode-panel 的点击开合与外部关闭
	// 已由 Navbar 的解析期委托统一处理；此处仅注册委托未覆盖的两个面板
	setClickOutsideToClose("search-panel", [
		"search-panel",
		"search-bar",
		"search-switch",
	]);
	setClickOutsideToClose("wallpaper-mode-panel", [
		"wallpaper-mode-panel",
		"wallpaper-mode-switch",
	]);

	setupSwupTransitions();
	initFullscreenWallpaper();
	registerContentOverflowListeners();
	// 滚动路径不再读取布局；先在初始化时填充侧边栏 top 容器可见性缓存
	refreshSidebarStickyState();
	initScroll();
	initTouchCodeCopyReveal();

	const onReady = () => {
		scheduleContentOverflowEnhancements();
		updateMainGridCols();
		updateSidebarComponentsVisibility();
		initWallpaperMode();
		initThemeListener();
		initIconLoader();
		syncFullscreenStateAfterInit();
	};
	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", onReady);
	} else {
		onReady();
	}

	initImageLoadFadeIn();

	document.addEventListener("astro:page-load", () => {
		requestAnimationFrame(initImageLoadFadeIn);
	});
}

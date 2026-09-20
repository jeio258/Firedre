import {
	WALLPAPER_BANNER,
	WALLPAPER_FULLSCREEN,
	WALLPAPER_NONE,
	WALLPAPER_OVERLAY,
} from "@constants/constants";
import {
	getPanelConfigFromWindow,
	getWallpaperConfigFromWindow,
} from "@shared/config/runtime";
import type { WALLPAPER_MODE } from "@/types/config";
import { backgroundWallpaper } from "../../config";
import { isHomePage as checkIsHomePage } from "../layout-utils";
import { applyStoredOverlaySettingsToDocument } from "./overlay";

export function syncBannerHomeTextVisibility(): void {
	const overlay = document.querySelector(
		".banner-home-text-overlay",
	) as HTMLElement | null;
	if (!overlay) return;
	const mode = document.documentElement.getAttribute("data-wallpaper-mode");
	const isHome = checkIsHomePage(window.location.pathname);
	const show =
		isHome && (mode === WALLPAPER_BANNER || mode === WALLPAPER_FULLSCREEN);
	overlay.classList.toggle("hidden", !show);
}

function applyWallpaperModeToDocument(
	mode: WALLPAPER_MODE,
	animate = true,
): void {
	const html = document.documentElement;
	const prevMode = html.getAttribute("data-wallpaper-mode");

	if (animate) {
		html.classList.add("is-wallpaper-transitioning");
		window.setTimeout(
			() => html.classList.remove("is-wallpaper-transitioning"),
			520,
		);
	}

	html.setAttribute("data-wallpaper-mode", mode);

	syncBannerHomeTextVisibility();

	// 卡片透明类：唯一运行时写入者（解析期由 body 起始脚本写入）
	const transparent = mode === "overlay" || mode === "fullscreen";
	document.body.classList.toggle("wallpaper-transparent", transparent);

	if (
		(mode === WALLPAPER_FULLSCREEN && prevMode === WALLPAPER_BANNER) ||
		(mode === WALLPAPER_BANNER && prevMode === WALLPAPER_FULLSCREEN)
	) {
		const title = document.querySelector(
			".banner-home-text-overlay",
		) as HTMLElement | null;
		if (title && !title.classList.contains("hidden")) {
			const deltaVh = mode === WALLPAPER_FULLSCREEN ? -17.5 : 17.5;
			title.style.transition = "none";
			title.style.transform = `translateY(${deltaVh}vh)`;
			void title.offsetWidth;
			title.style.transition =
				"transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)";
			title.style.transform = "translateY(0)";
		}
	}

	updateNavbarTransparency(mode);
	window.dispatchEvent(
		new CustomEvent("wallpaperModeChange", { detail: { mode } }),
	);
}

export function updateNavbarTransparency(mode: WALLPAPER_MODE): void {
	const navbar = document.getElementById("navbar");
	if (!navbar) return;

	let transparentMode: string;
	let blurAmount: number;

	// 根据当前壁纸模式设置导航栏透明模式和模糊效果
	if (mode === WALLPAPER_OVERLAY) {
		transparentMode = "none";
		blurAmount = 0;
	} else if (mode === WALLPAPER_NONE) {
		transparentMode = "none";
		blurAmount = 0;
	} else if (mode === WALLPAPER_FULLSCREEN) {
		const isHomePage = checkIsHomePage(window.location.pathname);
		const dynamicTransparent =
			backgroundWallpaper.fullscreen?.navbar?.dynamicTransparent ?? false;
		if (isHomePage && dynamicTransparent) {
			transparentMode = "semifull";
			blurAmount = 0;
		} else {
			transparentMode = "none";
			blurAmount = 0;
		}
	} else {
		// Banner模式：使用配置的透明模式和模糊效果
		transparentMode =
			backgroundWallpaper.banner?.navbar?.transparentMode || "semi";
		blurAmount = backgroundWallpaper.banner?.navbar?.blur ?? 20;
	}

	navbar.setAttribute("data-transparent-mode", transparentMode);
	navbar.style.setProperty("--navbar-glass-blur", `${blurAmount}px`);

	navbar.classList.remove(
		"navbar-transparent-semi",
		"navbar-transparent-full",
		"navbar-transparent-semifull",
	);

	navbar.classList.remove("scrolled");

	if (
		transparentMode === "semifull" &&
		(mode === WALLPAPER_BANNER || mode === WALLPAPER_FULLSCREEN) &&
		typeof window.initSemifullScrollDetection === "function"
	) {
		// 在Banner和全屏壁纸模式的semifull下启用滚动检测
		window.initSemifullScrollDetection();
	} else if (window.semifullScrollHandler) {
		window.removeEventListener("scroll", window.semifullScrollHandler);
		delete window.semifullScrollHandler;
	}
}

export function setWallpaperMode(mode: WALLPAPER_MODE): void {
	if (
		typeof localStorage === "undefined" ||
		typeof localStorage.setItem !== "function"
	) {
		return;
	}
	localStorage.setItem("wallpaperMode", mode);
	applyWallpaperModeToDocument(mode);
}

export function initWallpaperMode(): void {
	// 初始化透明模式参数（透明度/模糊度/卡片透明度）
	applyStoredOverlaySettingsToDocument();
	const storedMode = getStoredWallpaperMode();
	applyWallpaperModeToDocument(storedMode, false);
}

export function getStoredWallpaperMode(): WALLPAPER_MODE {
	const runtimeMode = getWallpaperConfigFromWindow().mode;
	if (
		typeof localStorage === "undefined" ||
		typeof localStorage.getItem !== "function"
	) {
		return runtimeMode;
	}

	const isSwitchable = getPanelConfigFromWindow().wallpaperModeSwitchable;
	if (!isSwitchable) {
		localStorage.removeItem("wallpaperMode");
		return runtimeMode;
	}

	return (
		(localStorage.getItem("wallpaperMode") as WALLPAPER_MODE) || runtimeMode
	);
}

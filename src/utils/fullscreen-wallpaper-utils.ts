import { backgroundWallpaper } from "@/config";
import { pathsEqual, url } from "@/utils/url-utils";

const TITLE_FADE_RATIO = 0.5;                    
const BLUR_RAMP_SCROLL = 300;                                       
const BLUR_QUANTIZE_STEP = 2;                                  
let parallaxTicking = false;
let cachedMaxBlur: number | null = null;                                        
let lastWrittenBlur = "";                                      

export function updateFullscreenTitleParallax(): void {
	const html = document.documentElement;
	const overlay = document.getElementById("banner-overlay-container");
	if (!overlay) return;

	if (
		html.getAttribute("data-wallpaper-mode") !== "fullscreen" ||
		html.classList.contains("is-animating") ||
		html.classList.contains("is-changing")
	) {
		overlay.style.transform = "";
		overlay.style.opacity = "";
		return;
	}
	// 仅首页使用 hero 标题；非首页与 overlay 一致（无标题覆盖层）
	if (!pathsEqual(window.location.pathname, url("/"))) {
		overlay.style.transform = "";
		overlay.style.opacity = "";
		return;
	}
	const scrollY = window.pageYOffset || document.documentElement.scrollTop;
	// 标题随滚动上移，同时透明度渐变到 0（渐变消失，不弹跳）
	const fadeScroll = window.innerHeight * TITLE_FADE_RATIO;
	const ratio = Math.min(scrollY / fadeScroll, 1);
	overlay.style.transform = `translateY(${-scrollY}px)`;
	overlay.style.opacity = String(1 - ratio);
}

function requestFullscreenTitleParallax(): void {
	if (!parallaxTicking) {
		parallaxTicking = true;
		requestAnimationFrame(() => {
			parallaxTicking = false;
			updateFullscreenTitleParallax();
			syncFullscreenBlur();
		});
	}
}

export function syncFullscreenOverlays(): void {
	const mode = document.documentElement.getAttribute("data-wallpaper-mode");
	const isHome = pathsEqual(window.location.pathname, url("/"));
	const overlays = document.querySelectorAll(
		"#banner-overlay-container .banner-home-text-overlay, #banner-overlay-container .banner-page-title-overlay, #banner-overlay-container .banner-post-meta-overlay",
	);
	overlays.forEach((el) => {
		const element = el as HTMLElement;
		if (mode === "fullscreen" && !isHome) {
			element.style.setProperty("display", "none", "important");
		} else {
			element.style.removeProperty("display");
		}
	});
}

export function syncFullscreenBlur(): void {
	const html = document.documentElement;
	const wrapper = document.getElementById("wallpaper-wrapper");
	if (!wrapper) return;
	if (html.getAttribute("data-wallpaper-mode") !== "fullscreen") {
		setBlurIfChanged(wrapper, "0px");
		return;
	}
	// 按设备开关决定全屏模式是否启用模糊（关闭则该设备上首页与非首页都保持清晰）
	if (!isBlurRampEnabled()) {
		setBlurIfChanged(wrapper, "0px");
		return;
	}

	const safeMax = cachedMaxBlur ?? readMaxBlur(wrapper);
	const isHome = pathsEqual(window.location.pathname, url("/"));
	if (!isHome) {
		setBlurIfChanged(wrapper, `${safeMax}px`);
		return;
	}
	const scrollY = window.pageYOffset || document.documentElement.scrollTop;
	const ratio = Math.min(scrollY / BLUR_RAMP_SCROLL, 1);
	setBlurIfChanged(wrapper, `${quantizeBlur(ratio * safeMax)}px`);
}

function isBlurRampEnabled(): boolean {
	const enable = backgroundWallpaper.fullscreen?.blurRamp?.enable;
	if (typeof enable === "boolean") return enable;
	if (!enable) return true;
	return window.innerWidth < 1024 ? enable.mobile : enable.desktop;
}

function readMaxBlur(wrapper: HTMLElement): number {
	const maxBlur = Number.parseFloat(
		window.getComputedStyle(wrapper).getPropertyValue("--overlay-blur"),
	);
	const safeMax = Number.isFinite(maxBlur) && maxBlur > 0 ? maxBlur : 0;
	cachedMaxBlur = safeMax;
	return safeMax;
}

function quantizeBlur(value: number): number {
	return Math.floor(value / BLUR_QUANTIZE_STEP) * BLUR_QUANTIZE_STEP;
}

function setBlurIfChanged(wrapper: HTMLElement, value: string): void {
	if (value === lastWrittenBlur) return;
	lastWrittenBlur = value;
	wrapper.style.setProperty("--fullscreen-blur", value);
}

export function initFullscreenWallpaper(): void {
	window.addEventListener("scroll", requestFullscreenTitleParallax, {
		passive: true,
	});
	window.addEventListener("wallpaperModeChange", () => {
		requestAnimationFrame(updateFullscreenTitleParallax);
		syncFullscreenBlur();
	});
	window.addEventListener("wallpaperModeChange", syncFullscreenOverlays);
	updateFullscreenTitleParallax();                     
	syncFullscreenOverlays();                   
	syncFullscreenBlur();                 

	const wrapper = document.getElementById("wallpaper-wrapper");
	if (!wrapper) return;
	let lastOverlayBlur = wrapper.style.getPropertyValue("--overlay-blur");
	const observer = new MutationObserver(() => {
		const current = wrapper.style.getPropertyValue("--overlay-blur");
		if (current !== lastOverlayBlur) {
			lastOverlayBlur = current;
			cachedMaxBlur = null; // 配置已变，强制下次同步时重读
			syncFullscreenBlur();
		}
	});
	observer.observe(wrapper, { attributes: true, attributeFilter: ["style"] });
}

export function syncFullscreenStateAfterInit(): void {
	syncFullscreenBlur();
	syncFullscreenOverlays();
	updateFullscreenTitleParallax();
}

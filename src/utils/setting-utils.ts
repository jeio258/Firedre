import {
	DARK_MODE,
	DEFAULT_THEME,
	LIGHT_MODE,
	SYSTEM_MODE,
	WALLPAPER_BANNER,
	WALLPAPER_FULLSCREEN,
	WALLPAPER_NONE,
	WALLPAPER_OVERLAY,
} from "@constants/constants";
import type { LIGHT_DARK_MODE, WALLPAPER_MODE } from "@/types/config";
import {
	backgroundWallpaper,
	expressiveCodeConfig,
	sakuraConfig,
	siteConfig,
} from "../config";
import {
	getEffectsConfigFromWindow,
	getPanelConfigFromWindow,
	getSiteConfigFromWindow,
	getWallpaperConfigFromWindow,
} from "../config/runtime";
import { isHomePage as checkIsHomePage } from "./layout-utils";

// Declare global functions
declare global {
	interface Window {
		initSemifullScrollDetection?: () => void;
		semifullScrollHandler?: () => void;
	}
}

interface BooleanSettingOpts {
	key: string;
	getDefault: () => boolean;
	/** set 时：若提供且返回 false，则跳过 localStorage 写入（apply 仍执行）。 */
	shouldStore?: () => boolean;
	/** set 时：写入 localStorage 后执行（通常是 apply 逻辑）。 */
	afterStore?: (value: boolean) => void;
}

/**
 * 生成 boolean 设置的 getStored/set 样板（localStorage 环境检查 + 空值回退）。
 * 各设置的默认值来源 getDefault 与写入后副作用 afterStore 由调用方显式提供。
 */
function createStoredBoolean({ key, getDefault, shouldStore, afterStore }: BooleanSettingOpts) {
	return {
		getStored(): boolean {
			if (typeof localStorage === "undefined") return getDefault();
			const stored = localStorage.getItem(key);
			return stored === null ? getDefault() : stored === "true";
		},
		set(value: boolean): void {
			const canStore =
				typeof localStorage !== "undefined" &&
				typeof localStorage.setItem === "function";
			if (canStore && (!shouldStore || shouldStore())) {
				localStorage.setItem(key, String(value));
			}
			afterStore?.(value);
		},
	};
}

export function getDefaultHue(): number {
	const fallback = "250";
	// 检查是否在浏览器环境中
	if (typeof document === "undefined") {
		return Number.parseInt(fallback, 10);
	}
	const configCarrier = document.getElementById("config-carrier");
	return Number.parseInt(configCarrier?.dataset.hue || fallback, 10);
}

export function getDefaultTheme(): LIGHT_DARK_MODE {
	// 统一从后台 settings 读取默认主题，静态 config 仅兑底
	return (getSiteConfigFromWindow().themeColor?.defaultMode ?? siteConfig.themeColor.defaultMode ?? DEFAULT_THEME) as LIGHT_DARK_MODE;
}

// 获取系统主题
export function getSystemTheme(): LIGHT_DARK_MODE {
	if (typeof window === "undefined") {
		return LIGHT_MODE;
	}
	return window.matchMedia("(prefers-color-scheme: dark)").matches
		? DARK_MODE
		: LIGHT_MODE;
}

// 解析主题（如果是system模式，则获取系统主题）
export function resolveTheme(theme: LIGHT_DARK_MODE): LIGHT_DARK_MODE {
	if (theme === SYSTEM_MODE) {
		return getSystemTheme();
	}
	return theme;
}

export function getHue(): number {
	// 先检查全局对象
	if (typeof window === "undefined" || !window.localStorage) {
		return getDefaultHue();
	}
	const stored = localStorage.getItem("hue");
	return stored ? Number.parseInt(stored, 10) : getDefaultHue();
}

export function setHue(hue: number): void {
	// 先检查是否在浏览器环境
	if (
		typeof window === "undefined" ||
		!window.localStorage ||
		typeof document === "undefined"
	) {
		return;
	}
	localStorage.setItem("hue", String(hue));
	const r = document.querySelector(":root") as HTMLElement;
	if (!r) {
		return;
	}
	r.style.setProperty("--hue", String(hue));
}

export function applyThemeToDocument(theme: LIGHT_DARK_MODE): void {
	// 检查是否在浏览器环境中
	if (typeof document === "undefined") {
		return;
	}

	// 解析主题
	const resolvedTheme = resolveTheme(theme);

	// 获取当前主题状态的完整信息
	const currentIsDark = document.documentElement.classList.contains("dark");
	const currentTheme = document.documentElement.getAttribute("data-theme");

	// 计算目标主题状态
	let targetIsDark = false; // 初始化默认值
	switch (resolvedTheme) {
		case LIGHT_MODE:
			targetIsDark = false;
			break;
		case DARK_MODE:
			targetIsDark = true;
			break;
		default:
			// 处理默认情况，使用当前主题状态
			targetIsDark = currentIsDark;
			break;
	}

	// 检测是否真的需要主题切换：
	// 1. dark类状态是否改变
	// 2. expressiveCode主题是否需要更新
	const needsThemeChange = currentIsDark !== targetIsDark;
	const expectedTheme = targetIsDark
		? expressiveCodeConfig.darkTheme
		: expressiveCodeConfig.lightTheme;
	const needsCodeThemeUpdate = currentTheme !== expectedTheme;

	// 如果既不需要主题切换也不需要代码主题更新，直接返回
	if (!needsThemeChange && !needsCodeThemeUpdate) {
		return;
	}

	// 批量 DOM 操作，减少重绘
	if (needsThemeChange) {
		// 添加过渡保护类（但会导致大量重绘，所以使用更轻量的方式）
		// document.documentElement.classList.add("is-theme-transitioning");

		// 直接切换主题，利用 CSS 变量的特性让浏览器优化过渡
		if (targetIsDark) {
			document.documentElement.classList.add("dark");
		} else {
			document.documentElement.classList.remove("dark");
		}
	}

	// Set the theme for Expressive Code based on current mode
	if (needsCodeThemeUpdate) {
		document.documentElement.setAttribute("data-theme", expectedTheme);
	}
}

// 系统主题监听器引用
let systemThemeListener:
	| ((e: MediaQueryListEvent | MediaQueryList) => void)
	| null = null;

export function setTheme(theme: LIGHT_DARK_MODE): void {
	// 检查是否在浏览器环境中
	if (
		typeof localStorage === "undefined" ||
		typeof localStorage.setItem !== "function"
	) {
		return;
	}

	// 先应用主题
	applyThemeToDocument(theme);

	// 保存到localStorage
	localStorage.setItem("theme", theme);

	// 如果切换到 system 模式，需要监听系统主题变化
	if (theme === SYSTEM_MODE) {
		setupSystemThemeListener();
	} else {
		// 如果切换其他模式，移除系统主题监听
		cleanupSystemThemeListener();
	}
}

// 设置系统主题监听器
export function setupSystemThemeListener(): void {
	// 先清理之前的监听器
	cleanupSystemThemeListener();

	if (typeof window === "undefined") {
		return;
	}

	const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

	// 处理系统主题变化的回调
	const handleSystemThemeChange = (e: MediaQueryListEvent | MediaQueryList) => {
		const isDark = e.matches;
		const currentIsDark = document.documentElement.classList.contains("dark");

		// 如果主题状态没有变化，直接返回
		if (currentIsDark === isDark) {
			return;
		}

		// 直接应用系统主题，不使用过渡保护类以避免大量重绘
		if (isDark) {
			document.documentElement.classList.add("dark");
		} else {
			document.documentElement.classList.remove("dark");
		}

		// Set the theme for Expressive Code
		const expressiveTheme = isDark
			? expressiveCodeConfig.darkTheme
			: expressiveCodeConfig.lightTheme;
		document.documentElement.setAttribute("data-theme", expressiveTheme);

		// 触发自定义事件通知其他组件（仅在真正切换时触发）
		window.dispatchEvent(new CustomEvent("theme-change"));
	};

	// 立即调用一次以设置初始状态
	handleSystemThemeChange(mediaQuery);

	// 监听系统主题变化（现代浏览器）
	if (mediaQuery.addEventListener) {
		mediaQuery.addEventListener("change", handleSystemThemeChange);
	} else {
		// 兼容旧浏览器
		mediaQuery.addListener(handleSystemThemeChange);
	}

	systemThemeListener = handleSystemThemeChange;
}

// 清理系统主题监听器
function cleanupSystemThemeListener() {
	if (typeof window === "undefined" || !systemThemeListener) {
		return;
	}

	const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

	if (mediaQuery.removeEventListener) {
		mediaQuery.removeEventListener("change", systemThemeListener);
	} else {
		// 兼容旧浏览器
		mediaQuery.removeListener(systemThemeListener);
	}

	systemThemeListener = null;
}

export function getStoredTheme(): LIGHT_DARK_MODE {
	// 检查是否在浏览器环境中
	if (
		typeof localStorage === "undefined" ||
		typeof localStorage.getItem !== "function"
	) {
		return getDefaultTheme();
	}
	return (
		(localStorage.getItem("theme") as LIGHT_DARK_MODE) || getDefaultTheme()
	);
}

// 初始化主题监听器（用于页面加载后）
export function initThemeListener(): void {
	if (
		typeof localStorage === "undefined" ||
		typeof localStorage.getItem !== "function"
	) {
		return;
	}

	const theme = getStoredTheme();

	// 如果主题是 system 模式，需要监听系统主题变化
	if (theme === SYSTEM_MODE) {
		setupSystemThemeListener();
	}
}

// Wallpaper mode functions

/**
 * 同步首页标题显示（hidden 类）：首页 + banner/fullscreen 模式显示标题，其余情况隐藏。
 * SSR 按 config 默认模式渲染 hidden（默认 overlay/none 时带 hidden），而模式可运行时切换、
 * 页面也会经 Swup 切换（body.is-home 变化），因此需要按当前 mode + 是否首页重新计算。
 * 标题开关（user-hidden 类）独立控制，不受影响。
 */
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

export function applyWallpaperModeToDocument(
	mode: WALLPAPER_MODE,
	animate = true,
): void {
	const html = document.documentElement;
	const prevMode = html.getAttribute("data-wallpaper-mode");

	// 先启用过渡类再设置模式：确保 --content-top 变化时 top 过渡已激活（否则位置瞬间到位不动画）
	if (animate) {
		html.classList.add("is-wallpaper-transitioning");
		window.setTimeout(
			() => html.classList.remove("is-wallpaper-transitioning"),
			520,
		);
	}

	html.setAttribute("data-wallpaper-mode", mode);

	// 首页标题显示：按当前模式 + 是否首页同步 hidden 类（SSR 按 config 默认模式渲染 hidden，
	// 模式运行时切换后需同步）。放在标题动画之前，让下方动画的 !contains("hidden") 判断拿到最新状态。
	syncBannerHomeTextVisibility();

	// 卡片透明类：唯一运行时写入者（解析期由 body 起始脚本写入）
	const transparent = mode === "overlay" || mode === "fullscreen";
	document.body.classList.toggle("wallpaper-transparent", transparent);

	// 标题上下移动动画：banner ↔ fullscreen 切换时 wrapper 高度瞬时变化，
	// 用 transform 补偿后滑到居中位置（首页标题可见时才动画）
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
		// 全屏透明模式
		transparentMode = "none";
		blurAmount = 0;
	} else if (mode === WALLPAPER_NONE) {
		// 纯色背景模式
		transparentMode = "none";
		blurAmount = 0;
	} else if (mode === WALLPAPER_FULLSCREEN) {
		// 全屏壁纸模式：脱离 banner 导航栏配置，导航栏默认完全透明
		// （透明度由卡片透明度 cardOpacity 经 wallpaper-transparent 控制）；
		// 若开启 fullscreen.navbar.dynamicTransparent，首页顶部透明、下滑后变不透明（semifull）
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

	// 更新导航栏的透明模式属性
	navbar.setAttribute("data-transparent-mode", transparentMode);
	navbar.style.setProperty("--navbar-glass-blur", `${blurAmount}px`);

	// 移除现有的透明模式类
	navbar.classList.remove(
		"navbar-transparent-semi",
		"navbar-transparent-full",
		"navbar-transparent-semifull",
	);

	// 移除scrolled类
	navbar.classList.remove("scrolled");

	// 滚动检测功能
	if (
		transparentMode === "semifull" &&
		(mode === WALLPAPER_BANNER || mode === WALLPAPER_FULLSCREEN) &&
		typeof window.initSemifullScrollDetection === "function"
	) {
		// 在Banner和全屏壁纸模式的semifull下启用滚动检测
		window.initSemifullScrollDetection();
	} else if (window.semifullScrollHandler) {
		// 移除滚动监听器
		window.removeEventListener("scroll", window.semifullScrollHandler);
		delete window.semifullScrollHandler;
	}
}

export function setWallpaperMode(mode: WALLPAPER_MODE): void {
	// 检查是否在浏览器环境中
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
	// 统一从后台 settings（window.__FIREFLY_SETTINGS__）读取真实壁纸模式，静态 config 仅兜底
	const runtimeMode = getWallpaperConfigFromWindow().mode;
	// 检查是否在浏览器环境中
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

	return (localStorage.getItem("wallpaperMode") as WALLPAPER_MODE) || runtimeMode;
}

// Overlay settings functions
function clampNumber(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

export function getDefaultOverlayOpacity(): number {
	return getWallpaperConfigFromWindow().overlay?.opacity ?? backgroundWallpaper.overlay?.opacity ?? 0.8;
}

export function getDefaultOverlayBlur(): number {
	return getWallpaperConfigFromWindow().overlay?.blur ?? backgroundWallpaper.overlay?.blur ?? 0;
}

export function getDefaultOverlayCardOpacity(): number {
	// 优先读后台配置（runtime 已归一化 theme.overlayCardOpacity → overlay.cardOpacity），静态 config 兑底
	return getWallpaperConfigFromWindow().overlay?.cardOpacity ?? backgroundWallpaper.overlay?.cardOpacity ?? 0.6;
}

export function getStoredOverlayOpacity(): number {
	if (
		typeof localStorage === "undefined" ||
		typeof localStorage.getItem !== "function"
	) {
		return getDefaultOverlayOpacity();
	}
	const stored = localStorage.getItem("overlayOpacity");
	if (stored === null) {
		return getDefaultOverlayOpacity();
	}
	const parsed = Number.parseFloat(stored);
	if (Number.isNaN(parsed)) {
		return getDefaultOverlayOpacity();
	}
	return clampNumber(parsed, 0, 1);
}

export function getStoredOverlayBlur(): number {
	if (
		typeof localStorage === "undefined" ||
		typeof localStorage.getItem !== "function"
	) {
		return getDefaultOverlayBlur();
	}
	const stored = localStorage.getItem("overlayBlur");
	if (stored === null) {
		return getDefaultOverlayBlur();
	}
	const parsed = Number.parseFloat(stored);
	if (Number.isNaN(parsed)) {
		return getDefaultOverlayBlur();
	}
	return clampNumber(parsed, 0, 20);
}

export function getStoredOverlayCardOpacity(): number {
	if (
		typeof localStorage === "undefined" ||
		typeof localStorage.getItem !== "function"
	) {
		return getDefaultOverlayCardOpacity();
	}
	const stored = localStorage.getItem("overlayCardOpacity");
	if (stored === null) {
		return getDefaultOverlayCardOpacity();
	}
	const parsed = Number.parseFloat(stored);
	if (Number.isNaN(parsed)) {
		return getDefaultOverlayCardOpacity();
	}
	return clampNumber(parsed, 0, 1);
}

export function applyOverlayOpacityToDocument(opacity: number): void {
	if (typeof document === "undefined") {
		return;
	}
	const safeOpacity = clampNumber(opacity, 0, 1);
	const wallpaperWrapper = document.getElementById("wallpaper-wrapper");
	if (wallpaperWrapper) {
		wallpaperWrapper.style.setProperty(
			"--overlay-opacity",
			String(safeOpacity),
		);
	}
}

export function applyOverlayBlurToDocument(blur: number): void {
	if (typeof document === "undefined") {
		return;
	}
	const safeBlur = clampNumber(blur, 0, 20);
	const wallpaperWrapper = document.getElementById("wallpaper-wrapper");
	if (wallpaperWrapper) {
		wallpaperWrapper.style.setProperty("--overlay-blur", `${safeBlur}px`);
	}
}

export function applyOverlayCardOpacityToDocument(cardOpacity: number): void {
	if (typeof document === "undefined") {
		return;
	}
	const safeCardOpacity = clampNumber(cardOpacity, 0, 1);
	document.documentElement.style.setProperty(
		"--card-transparent-opacity",
		String(safeCardOpacity),
	);
}

export function setOverlayOpacity(opacity: number): void {
	const safeOpacity = clampNumber(opacity, 0, 1);
	if (
		typeof localStorage !== "undefined" &&
		typeof localStorage.setItem === "function"
	) {
		localStorage.setItem("overlayOpacity", String(safeOpacity));
	}
	applyOverlayOpacityToDocument(safeOpacity);
}

export function setOverlayBlur(blur: number): void {
	const safeBlur = clampNumber(blur, 0, 20);
	if (
		typeof localStorage !== "undefined" &&
		typeof localStorage.setItem === "function"
	) {
		localStorage.setItem("overlayBlur", String(safeBlur));
	}
	applyOverlayBlurToDocument(safeBlur);
}

export function setOverlayCardOpacity(cardOpacity: number): void {
	const safeCardOpacity = clampNumber(cardOpacity, 0, 1);
	if (
		typeof localStorage !== "undefined" &&
		typeof localStorage.setItem === "function"
	) {
		localStorage.setItem("overlayCardOpacity", String(safeCardOpacity));
	}
	applyOverlayCardOpacityToDocument(safeCardOpacity);
}

export function applyStoredOverlaySettingsToDocument(): void {
	applyOverlayOpacityToDocument(getStoredOverlayOpacity());
	applyOverlayBlurToDocument(getStoredOverlayBlur());
	applyOverlayCardOpacityToDocument(getStoredOverlayCardOpacity());
}

// Waves animation functions
export function getDefaultWavesEnabled(): boolean {
	const runtimeWaves = getEffectsConfigFromWindow().waves;
	const wavesConfig = backgroundWallpaper.banner?.waves?.enable;
	if (typeof runtimeWaves === "boolean") {
		return runtimeWaves;
	}
	if (typeof wavesConfig === "object") {
		// 如果是分设备配置，检查当前设备
		const isMobile =
			typeof window !== "undefined" ? window.innerWidth < 768 : false;
		return isMobile
			? (wavesConfig.mobile ?? false)
			: (wavesConfig.desktop ?? false);
	}
	return wavesConfig ?? false;
}

const wavesSetting = createStoredBoolean({
	key: "wavesEnabled",
	getDefault: getDefaultWavesEnabled,
	afterStore: applyWavesEnabledToDocument,
});

export function getStoredWavesEnabled(): boolean {
	return wavesSetting.getStored();
}
export function setWavesEnabled(enabled: boolean): void {
	wavesSetting.set(enabled);
}

export function applyWavesEnabledToDocument(enabled: boolean): void {
	if (typeof document === "undefined") {
		return;
	}
	// 更新 html 属性，CSS 会立即生效
	document.documentElement.setAttribute("data-waves-enabled", String(enabled));
	// 同时更新元素样式（兼容性）
	const wavesElement = document.getElementById("header-waves");
	if (wavesElement) {
		if (enabled) {
			wavesElement.style.display = "";
			wavesElement.classList.remove("waves-disabled");
		} else {
			wavesElement.style.display = "none";
			wavesElement.classList.add("waves-disabled");
		}
	}
}

// Gradient transition functions
export function getDefaultGradientEnabled(): boolean {
	const runtimeGradient = getEffectsConfigFromWindow().gradient;
	const gradientConfig = backgroundWallpaper.banner?.gradient?.enable;
	if (typeof runtimeGradient === "boolean") {
		return runtimeGradient;
	}
	if (typeof gradientConfig === "object") {
		const isMobile =
			typeof window !== "undefined" ? window.innerWidth < 768 : false;
		return isMobile
			? (gradientConfig.mobile ?? true)
			: (gradientConfig.desktop ?? true);
	}
	return gradientConfig ?? true;
}

const gradientSetting = createStoredBoolean({
	key: "gradientEnabled",
	getDefault: getDefaultGradientEnabled,
	afterStore: applyGradientEnabledToDocument,
});
export function getStoredGradientEnabled(): boolean {
	return gradientSetting.getStored();
}
export function setGradientEnabled(enabled: boolean): void {
	gradientSetting.set(enabled);
}

export function applyGradientEnabledToDocument(enabled: boolean): void {
	if (typeof document === "undefined") {
		return;
	}
	document.documentElement.setAttribute(
		"data-gradient-enabled",
		String(enabled),
	);
	const gradientElement = document.getElementById("wallpaper-gradient");
	if (gradientElement) {
		if (enabled) {
			gradientElement.style.display = "";
			gradientElement.classList.remove("gradient-disabled");
		} else {
			gradientElement.style.display = "none";
			gradientElement.classList.add("gradient-disabled");
		}
	}
}

// Sakura effect functions
export function getDefaultSakuraEnabled(): boolean {
	return getEffectsConfigFromWindow().enable ?? sakuraConfig?.enable ?? false;
}

const sakuraSetting = createStoredBoolean({
	key: "sakuraEnabled",
	getDefault: getDefaultSakuraEnabled,
	afterStore(enabled: boolean): void {
		if (typeof document === "undefined") return;
		document.documentElement.setAttribute("data-sakura-enabled", String(enabled));
		if (typeof window !== "undefined") {
			window.dispatchEvent(new CustomEvent("sakuraToggle", { detail: { enabled } }));
		}
	},
});
export function getStoredSakuraEnabled(): boolean {
	return sakuraSetting.getStored();
}
export function setSakuraEnabled(enabled: boolean): void {
	sakuraSetting.set(enabled);
}

// Banner title functions
export function getDefaultBannerTitleEnabled(): boolean {
	return getWallpaperConfigFromWindow().common?.homeText?.enable ?? backgroundWallpaper.common?.homeText?.enable ?? true;
}

export function getDefaultBannerCarouselEnabled(): boolean {
	return getEffectsConfigFromWindow().bannerCarousel ?? backgroundWallpaper.common?.carousel?.enable ?? false;
}

const bannerTitleSetting = createStoredBoolean({
	key: "bannerTitleEnabled",
	getDefault: getDefaultBannerTitleEnabled,
	afterStore: applyBannerTitleEnabledToDocument,
});

export function getStoredBannerTitleEnabled(): boolean {
	return bannerTitleSetting.getStored();
}

export function getStoredBannerCarouselEnabled(): boolean {
	const isSwitchable = getPanelConfigFromWindow().bannerCarouselSwitchable;
	if (!isSwitchable) {
		return getDefaultBannerCarouselEnabled();
	}
	if (
		typeof localStorage === "undefined" ||
		typeof localStorage.getItem !== "function"
	) {
		return getDefaultBannerCarouselEnabled();
	}
	const stored = localStorage.getItem("bannerCarouselEnabled");
	if (stored === null) {
		return getDefaultBannerCarouselEnabled();
	}
	return stored === "true";
}

export function setBannerTitleEnabled(enabled: boolean): void {
	bannerTitleSetting.set(enabled);
}
export function setBannerCarouselEnabled(enabled: boolean): void {
	const safeEnabled = !!enabled;
	const isSwitchable = getPanelConfigFromWindow().bannerCarouselSwitchable;
	if (
		isSwitchable &&
		typeof localStorage !== "undefined" &&
		typeof localStorage.setItem === "function"
	) {
		localStorage.setItem("bannerCarouselEnabled", String(safeEnabled));
	}
	applyBannerCarouselEnabledToDocument(safeEnabled);
	if (typeof window !== "undefined") {
		window.dispatchEvent(
			new CustomEvent("bannerCarouselChange", {
				detail: { enabled: safeEnabled },
			}),
		);
	}
}

export function applyBannerTitleEnabledToDocument(enabled: boolean): void {
	if (typeof document === "undefined") {
		return;
	}
	// 更新 html 属性，CSS 会立即生效
	document.documentElement.setAttribute(
		"data-banner-title-enabled",
		String(enabled),
	);
	// 同时更新元素样式（兼容性）
	const bannerTextOverlay = document.querySelector(
		".banner-home-text-overlay",
	) as HTMLElement;
	if (bannerTextOverlay) {
		if (enabled) {
			bannerTextOverlay.classList.remove("user-hidden");
		} else {
			bannerTextOverlay.classList.add("user-hidden");
		}
	}
}

export function applyBannerCarouselEnabledToDocument(enabled: boolean): void {
	if (typeof document === "undefined") {
		return;
	}
	document.documentElement.setAttribute(
		"data-banner-carousel-enabled",
		String(enabled),
	);
}

// Card border functions
export function getDefaultCardBorderEnabled(): boolean {
	return getSiteConfigFromWindow().card?.border ?? siteConfig.card?.border ?? false;
}

const cardBorderSetting = createStoredBoolean({
	key: "cardBorderEnabled",
	getDefault: getDefaultCardBorderEnabled,
	afterStore(enabled: boolean): void {
		if (typeof document === "undefined") return;
		if (enabled) document.documentElement.classList.add("enable-card-border");
		else document.documentElement.classList.remove("enable-card-border");
	},
});
export function getStoredCardBorderEnabled(): boolean {
	return cardBorderSetting.getStored();
}
export function setCardBorderEnabled(enabled: boolean): void {
	cardBorderSetting.set(enabled);
}

// Card follow theme functions
export function getDefaultCardFollowThemeEnabled(): boolean {
	return getSiteConfigFromWindow().card?.followTheme ?? siteConfig.card?.followTheme ?? false;
}

const cardFollowThemeSetting = createStoredBoolean({
	key: "cardFollowThemeEnabled",
	getDefault: getDefaultCardFollowThemeEnabled,
	afterStore(enabled: boolean): void {
		if (typeof document === "undefined") return;
		if (enabled) document.body.classList.add("card-follow-theme-hue");
		else document.body.classList.remove("card-follow-theme-hue");
	},
});
export function getStoredCardFollowThemeEnabled(): boolean {
	return cardFollowThemeSetting.getStored();
}
export function setCardFollowThemeEnabled(enabled: boolean): void {
	cardFollowThemeSetting.set(enabled);
}

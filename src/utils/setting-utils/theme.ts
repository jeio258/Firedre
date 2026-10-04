import {
	DARK_MODE,
	DEFAULT_THEME,
	LIGHT_MODE,
	SYSTEM_MODE,
} from "@constants/constants";
import {
	getExpressiveCodeConfigFromWindow,
	getSiteConfigFromWindow,
} from "@shared/config/runtime";
import type { LIGHT_DARK_MODE } from "@/types/config";
import { siteConfig } from "../../config";
import { createStoredBoolean } from "./shared";

export function getDefaultHue(): number {
	// 权威来源：客户端设置视图（后台配置的色相）；其次页面内的配置载体；最后才兜底。
	// 历史问题：直接退到硬编码 250，而面板挂载会把它写进 localStorage，导致用户
	// 从未设置却出现「本地色相」且长期覆盖云端配置。
	const configured = getSiteConfigFromWindow().themeColor?.hue;
	if (typeof configured === "number" && Number.isFinite(configured)) {
		return configured;
	}
	if (typeof document !== "undefined") {
		const carrier = document.getElementById("config-carrier");
		const parsed = carrier?.dataset.hue
			? Number.parseInt(carrier.dataset.hue, 10)
			: Number.NaN;
		if (Number.isFinite(parsed)) return parsed;
	}
	return 250;
}

function getDefaultTheme(): LIGHT_DARK_MODE {
	// 统一从后台 settings 读取默认主题，静态 config 仅兑底
	return (getSiteConfigFromWindow().themeColor?.defaultMode ??
		siteConfig.themeColor.defaultMode ??
		DEFAULT_THEME) as LIGHT_DARK_MODE;
}

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
	if (typeof window === "undefined" || !window.localStorage) {
		return getDefaultHue();
	}
	const stored = localStorage.getItem("hue");
	return stored ? Number.parseInt(stored, 10) : getDefaultHue();
}

export function setHue(hue: number): void {
	if (
		typeof window === "undefined" ||
		!window.localStorage ||
		typeof document === "undefined"
	) {
		return;
	}
	// hueSource=user 标记：只有用户真的动过色相才有本地偏好；无标记的存量值会在
	// Layout 的预渲染脚本里被清除并回落云端配置
	localStorage.setItem("hue", String(hue));
	localStorage.setItem("hueSource", "user");
	const r = document.querySelector(":root") as HTMLElement;
	if (!r) {
		return;
	}
	r.style.setProperty("--hue", String(hue));
}

export function applyThemeToDocument(theme: LIGHT_DARK_MODE): void {
	if (typeof document === "undefined") {
		return;
	}

	const resolvedTheme = resolveTheme(theme);

	const currentIsDark = document.documentElement.classList.contains("dark");
	const currentTheme = document.documentElement.getAttribute("data-theme");

	let targetIsDark = false;
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

	const needsThemeChange = currentIsDark !== targetIsDark;
	const expectedTheme = targetIsDark
		? getExpressiveCodeConfigFromWindow().darkTheme
		: getExpressiveCodeConfigFromWindow().lightTheme;
	const needsCodeThemeUpdate = currentTheme !== expectedTheme;

	// 如果既不需要主题切换也不需要代码主题更新，直接返回
	if (!needsThemeChange && !needsCodeThemeUpdate) {
		return;
	}

	// 批量 DOM 操作，减少重绘
	if (needsThemeChange) {
		if (targetIsDark) {
			document.documentElement.classList.add("dark");
		} else {
			document.documentElement.classList.remove("dark");
		}
	}

	if (needsCodeThemeUpdate) {
		document.documentElement.setAttribute("data-theme", expectedTheme);
	}
}

let systemThemeListener:
	| ((e: MediaQueryListEvent | MediaQueryList) => void)
	| null = null;

export function setTheme(theme: LIGHT_DARK_MODE): void {
	if (
		typeof localStorage === "undefined" ||
		typeof localStorage.setItem !== "function"
	) {
		return;
	}

	applyThemeToDocument(theme);

	localStorage.setItem("theme", theme);

	// 如果切换到 system 模式，需要监听系统主题变化
	if (theme === SYSTEM_MODE) {
		setupSystemThemeListener();
	} else {
		// 如果切换其他模式，移除系统主题监听
		cleanupSystemThemeListener();
	}
}

function setupSystemThemeListener(): void {
	cleanupSystemThemeListener();

	if (typeof window === "undefined") {
		return;
	}

	const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

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

		const expressiveTheme = isDark
			? getExpressiveCodeConfigFromWindow().darkTheme
			: getExpressiveCodeConfigFromWindow().lightTheme;
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
		mediaQuery.addListener(handleSystemThemeChange);
	}

	systemThemeListener = handleSystemThemeChange;
}

function cleanupSystemThemeListener() {
	if (typeof window === "undefined" || !systemThemeListener) {
		return;
	}

	const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

	if (mediaQuery.removeEventListener) {
		mediaQuery.removeEventListener("change", systemThemeListener);
	} else {
		mediaQuery.removeListener(systemThemeListener);
	}

	systemThemeListener = null;
}

export function getStoredTheme(): LIGHT_DARK_MODE {
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

export function getDefaultCardFollowThemeEnabled(): boolean {
	return (
		getSiteConfigFromWindow().card?.followTheme ??
		siteConfig.card?.followTheme ??
		false
	);
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

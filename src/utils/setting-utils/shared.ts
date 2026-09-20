import { isMobileViewport } from "../breakpoints";

export function clampNumber(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

interface BooleanSettingOpts {
	key: string;
	getDefault: () => boolean;

	shouldGet?: () => boolean;

	shouldStore?: () => boolean;

	afterStore?: (value: boolean) => void;
}

export function createStoredBoolean({
	key,
	getDefault,
	shouldGet,
	shouldStore,
	afterStore,
}: BooleanSettingOpts) {
	return {
		getStored(): boolean {
			if (shouldGet && !shouldGet()) {
				return getDefault();
			}
			if (
				typeof localStorage === "undefined" ||
				typeof localStorage.getItem !== "function"
			) {
				return getDefault();
			}
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

interface NumberSettingOpts {
	key: string;
	getDefault: () => number;
	min: number;
	max: number;

	afterStore?: (value: number) => void;
}

export function createStoredNumber({
	key,
	getDefault,
	min,
	max,
	afterStore,
}: NumberSettingOpts) {
	// 记录「存储时后台的默认值」：用户未显式自定义（存储值 == 记录的默认值）时，
	// 后台修改默认值后前端自动跟随，避免后台设置被本地残留偏好覆盖
	const readRecordedDefault = (): number | null => {
		if (
			typeof localStorage === "undefined" ||
			typeof localStorage.getItem !== "function"
		) {
			return null;
		}
		const raw = localStorage.getItem(`${key}:default`);
		return raw === null ? null : Number.parseFloat(raw);
	};
	return {
		getStored(): number {
			if (
				typeof localStorage === "undefined" ||
				typeof localStorage.getItem !== "function"
			) {
				return getDefault();
			}
			const stored = localStorage.getItem(key);
			if (stored === null) return getDefault();
			const parsed = Number.parseFloat(stored);
			if (Number.isNaN(parsed)) return getDefault();
			const recorded = readRecordedDefault();
			// 存储值与记录的默认值一致 → 用户未自定义，跟随后台的新默认值
			if (recorded !== null && parsed === recorded) {
				return clampNumber(getDefault(), min, max);
			}
			return clampNumber(parsed, min, max);
		},
		set(value: number): void {
			const safe = clampNumber(value, min, max);
			if (
				typeof localStorage !== "undefined" &&
				typeof localStorage.setItem === "function"
			) {
				localStorage.setItem(key, String(safe));
				// 记录当前后台默认值，供「未自定义则跟随」判断
				localStorage.setItem(
					`${key}:default`,
					String(clampNumber(getDefault(), min, max)),
				);
			}
			afterStore?.(safe);
		},
	};
}

export function createDeviceBooleanDefault(
	getRuntime: () => boolean | undefined,
	config: boolean | { mobile?: boolean; desktop?: boolean } | undefined,
	fallback: boolean,
): () => boolean {
	return (): boolean => {
		const runtime = getRuntime();
		if (typeof runtime === "boolean") return runtime;
		if (typeof config === "object") {
			// 如果是分设备配置，检查当前设备
			const isMobile = isMobileViewport();
			return isMobile
				? (config.mobile ?? fallback)
				: (config.desktop ?? fallback);
		}
		return config ?? fallback;
	};
}

export function createElementToggle(
	attr: string,
	elId: string,
	disabledClass: string,
): (enabled: boolean) => void {
	return (enabled: boolean): void => {
		if (typeof document === "undefined") return;
		// 更新 html 属性，CSS 会立即生效
		document.documentElement.setAttribute(attr, String(enabled));

		const el = document.getElementById(elId);
		if (el) {
			if (enabled) {
				el.style.display = "";
				el.classList.remove(disabledClass);
			} else {
				el.style.display = "none";
				el.classList.add(disabledClass);
			}
		}
	};
}

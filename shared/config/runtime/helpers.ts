// 内部共享工具（仅供 runtime/ 域模块使用，不对外新增导出面）
import type { BooknavFaviconConfig, BooknavGroup } from "@/types/booknavConfig";
import type { NavBarLink } from "@/types/navBarConfig";
import { settingsDefaults } from "../settings-defaults";

/** A5：defaults-only 视图（无 D1 覆盖），供无 locals 上下文的纯函数/桶使用 */
export const defaultsLocals: { settings: Record<string, unknown> } = {
	settings: settingsDefaults,
};

const DEFAULT_NAV_ITEMS: NavBarLink[] = (() => {
	try {
		return JSON.parse(
			(settingsDefaults.nav as { navItems: string }).navItems,
		) as NavBarLink[];
	} catch {
		return [];
	}
})();

// 书签导航默认 groups/favicon：单一默认源（defaults.bookmarks）解析
const DEFAULT_BOOKNAV_GROUPS: BooknavGroup[] = (() => {
	try {
		return JSON.parse(
			(settingsDefaults.bookmarks as { groups: string }).groups,
		) as BooknavGroup[];
	} catch {
		return [];
	}
})();
const DEFAULT_BOOKNAV_FAVICON = (() => {
	try {
		return JSON.parse(
			(settingsDefaults.bookmarks as { favicon: string }).favicon,
		) as BooknavFaviconConfig;
	} catch {
		return {} as BooknavFaviconConfig;
	}
})();

export type SettingsLike = Record<string, unknown>;

export function settingsOf(locals: unknown): SettingsLike {
	const s = ((locals as { settings?: unknown } | null | undefined)?.settings ??
		{}) as SettingsLike;
	return s ?? {};
}

export function groupOf(s: SettingsLike, key: string): SettingsLike {
	const g = s[key];
	return (g && typeof g === "object" ? g : {}) as SettingsLike;
}

export function str<T extends string>(v: unknown, fallback: T): T {
	return (typeof v === "string" && v !== "" ? v : fallback) as T;
}

export function num<T extends number>(v: unknown, fallback: T): T {
	return (typeof v === "number" && Number.isFinite(v) ? v : fallback) as T;
}

export function bool<T extends boolean>(v: unknown, fallback: T): T {
	if (typeof v === "boolean") return v as T;
	if (v === "true" || v === "false") return (v === "true") as T;
	return fallback;
}

export function arr(v: unknown, fallback: unknown[]): unknown[] {
	if (Array.isArray(v)) return v;
	if (typeof v === "string") {
		try {
			const p = JSON.parse(v);
			if (Array.isArray(p)) return p;
		} catch {}
	}
	return fallback;
}

export { DEFAULT_BOOKNAV_FAVICON, DEFAULT_BOOKNAV_GROUPS, DEFAULT_NAV_ITEMS };

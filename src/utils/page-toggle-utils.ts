import type { SiteConfig } from "@/types/siteConfig";

const TRUTHY_VALUES = ["true", "1", "on", "yes", "enable", "enabled"];
const FALSY_VALUES = ["false", "0", "off", "no", "disable", "disabled"];

// 解析布尔类型的环境变量，返回 undefined 表示未设置或取值无法识别
function parseBooleanEnv(raw: unknown): boolean | undefined {
	if (typeof raw !== "string") return undefined;
	const value = raw.trim().toLowerCase();
	if (TRUTHY_VALUES.includes(value)) return true;
	if (FALSY_VALUES.includes(value)) return false;
	return undefined;
}

function readPageEnv(key: string): unknown {
	const envKey = `PUBLIC_PAGES_${key.toUpperCase()}`;
	try {
		return (import.meta.env as Record<string, unknown>)[envKey];
	} catch {
		return typeof process === "undefined" ? undefined : process.env[envKey];
	}
}

export function resolvePageToggles(
	pages: SiteConfig["pages"],
): SiteConfig["pages"] {
	const result = { ...pages };
	for (const key of Object.keys(result) as (keyof SiteConfig["pages"])[]) {
		const parsed = parseBooleanEnv(readPageEnv(key));
		if (parsed !== undefined) {
			result[key] = parsed;
		}
	}
	return result;
}

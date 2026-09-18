import type { SiteConfig } from "@/types/siteConfig";

function readSiteLangEnv(): string | undefined {
	try {
		const raw = (import.meta.env as Record<string, unknown>).PUBLIC_SITE_LANG;
		return typeof raw === "string" && raw.trim() ? raw.trim() : undefined;
	} catch {
		return typeof process === "undefined"
			? undefined
			: process.env.PUBLIC_SITE_LANG;
	}
}

function normalizeSiteLang(
	value: string | undefined,
): SiteConfig["lang"] | undefined {
	if (!value) return undefined;
	const v = value.toLowerCase();
	if (v === "zh_cn" || v === "zh-cn") return "zh_CN";
	if (v === "zh_tw" || v === "zh-tw") return "zh_TW";
	if (v === "ja" || v === "ja_jp" || v === "ja-jp") return "ja";
	if (v === "ru" || v === "ru_ru" || v === "ru-ru") return "ru";
	if (v === "ko" || v === "ko_kr" || v === "ko-kr") return "ko";
	if (
		v === "en" ||
		v === "en_us" ||
		v === "en_gb" ||
		v === "en-us" ||
		v === "en-gb"
	) {
		return "en";
	}
	return undefined;
}

export function resolveSiteLang(
	defaultLang: SiteConfig["lang"],
): SiteConfig["lang"] {
	return normalizeSiteLang(readSiteLangEnv()) ?? defaultLang;
}

import type { SiteConfig } from "@/types/siteConfig";
import { parseBooleanEnv } from "./boolean-env";

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

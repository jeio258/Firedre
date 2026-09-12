import { musicPlayerConfig } from "@/config/musicConfig";

export function resolveShowLyrics(settings: unknown): boolean {
	const music = ((settings as { music?: unknown } | null | undefined)?.music ??
		{}) as Record<string, unknown>;
	return typeof music.showLyrics === "boolean"
		? music.showLyrics
		: (musicPlayerConfig.showLyrics ?? false);
}

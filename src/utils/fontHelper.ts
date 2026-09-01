

import type { FontSelectionConfig } from "../types/fontConfig";

export function collectUsedFontCssVars(
	config: FontSelectionConfig,
): Set<string> {
	const used = new Set<string>();

	const sel = config.selected;
	if (Array.isArray(sel)) {
		for (const v of sel) {
			if (v !== "system") used.add(v);
		}
	} else if (sel !== "system") {
		used.add(sel);
	}

	if (config.bannerTitleFont) used.add(config.bannerTitleFont);
	if (config.bannerSubtitleFont) used.add(config.bannerSubtitleFont);
	if (config.navbarTitleFont) used.add(config.navbarTitleFont);
	if (config.codeFont) used.add(config.codeFont);

	return used;
}

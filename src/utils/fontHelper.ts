/**
 * 字体工具函数
 *
 * 提供字体配置相关的共享逻辑，用于 astro.config.mjs 和 scripts/subset-fonts.ts。
 */

import type { FontSelectionConfig } from "../types/fontConfig";

/**
 * 从 fontConfig 中收集所有实际使用的字体 CSS 变量名。
 *
 * 包括：
 * - selected 中的非 "system" 值
 * - bannerTitleFont / bannerSubtitleFont / navbarTitleFont 区域覆盖
 * - codeFont 代码块字体
 *
 * @returns 去重后的 CSS 变量名集合（如 "--font-inter"）
 */
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

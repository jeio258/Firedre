export type BuiltinFontProvider =
	| "google"
	| "fontsource"
	| "local"
	| "bunny"
	| "fontshare"
	| "npm";

export interface CustomFontProvider {
	name: string;

	config?: Record<string, unknown>;
}

export type FontDefinition = {
	name: string;

	cssVariable: string;

	provider: BuiltinFontProvider | CustomFontProvider;

	weights?: Array<string | number>;

	styles?: Array<"normal" | "italic" | "oblique">;

	subsets?: string[];

	fallbacks?: string[];

	display?: "auto" | "optional" | "fallback" | "block" | "swap";

	/** 是否输出 `<link rel="preload" as="font">`；大体积字体（如 CJK）建议 false，
	 *  避免以最高优先级抢 LCP 带宽（仍经 CSS 按需加载）。缺省视为允许。 */
	preload?: boolean;

	options?: {
		variants?: Array<{
			src: string[];
			weight?: string | number;
			style?: string;
		}>;
		[key: string]: unknown;
	};
};

export type FontSelectionConfig = {
	enable: boolean;

	selected: string | string[];

	bannerTitleFont?: string;
	bannerSubtitleFont?: string;
	navbarTitleFont?: string;

	codeFont?: string;
};

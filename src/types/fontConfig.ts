
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

	subsetFonts?: Record<
		string,
		{

			extraChars?: string;
		}
	>;
};

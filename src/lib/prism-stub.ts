
export const Prism = {
	highlight: () => "",
	languages: {},
	plugins: {},
	util: { encode: (s: string) => s },
};
export function astroEscape(_html: string) {
	return "";
}

export function runHighlighterWithAstro() {
	return { html: "" };
}

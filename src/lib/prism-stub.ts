/**
 * @astrojs/prism 的 workerd loader 与 rolldown 虚拟模块不兼容。
 * Firedre 从不启用 prism 语法高亮（syntaxHighlight: false），故用空 stub 替代。
 */
export const Prism = {
	highlight: () => "",
	languages: {},
	plugins: {},
	util: { encode: (s: string) => s },
};
export function astroEscape(_html: string) {
	return "";
}

/** rehype-prism 需要的导出（实际永不执行） */
export function runHighlighterWithAstro() {
	return { html: "" };
}

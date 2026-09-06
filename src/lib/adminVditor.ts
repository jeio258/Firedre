// Vditor 后台明暗跟随：类同时加到 .vditor root 与 html（弹窗/面板在 body 末，需 html 继承）
export function syncVditorTheme(root: HTMLElement): void {
	const dark = document.documentElement.classList.contains("dark");
	document.documentElement.classList.toggle("vditor--dark", dark);
	root.classList.toggle("vditor--dark", dark);
}

// 监听 html class 变化并同步当前 Vditor 实例
export function observeVditorTheme(root: HTMLElement): MutationObserver {
	const mo = new MutationObserver(() => syncVditorTheme(root));
	mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
	return mo;
}

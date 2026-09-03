// Vditor 后台明暗跟随：给 .vditor 切换 vditor--dark 类
export function syncVditorTheme(root: HTMLElement): void {
	const dark = document.documentElement.classList.contains("dark");
	root.classList.toggle("vditor--dark", dark);
}

// 监听 html class 变化并同步当前 Vditor 实例
export function observeVditorTheme(root: HTMLElement): MutationObserver {
	const mo = new MutationObserver(() => syncVditorTheme(root));
	mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
	return mo;
}

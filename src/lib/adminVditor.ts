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

type VditorInstance = import("vditor").default;

/** 统一的 Vditor 初始化：所见即所得模式 + 本地 CDN + 明暗主题跟随 */
export async function createAdminVditor(
	selector: string,
	options: {
		value: string;
		height: number;
		upload?: { url: string; fieldName: string; headers: Record<string, string> };
		onThemeObserver: (mo: MutationObserver) => void;
	},
): Promise<VditorInstance> {
	const { default: Vditor } = await import("vditor");
	return new Vditor(selector, {
		height: options.height,
		mode: "wysiwyg",
		value: options.value,
		cdn: "/vditor",
		cache: { enable: false },
		...(options.upload ? { upload: options.upload } : {}),
		after: () => {
			const root = document.querySelector<HTMLElement>(".vditor");
			if (root) {
				syncVditorTheme(root);
				options.onThemeObserver(observeVditorTheme(root));
			}
		},
	});
}

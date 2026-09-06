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

export interface VditorMountOptions {
	value?: string;
	height?: number;
	// 透传给 Vditor 的其它配置（upload 等）
	options?: Record<string, unknown>;
}

export interface VditorMountResult {
	editor: unknown;
	observer: MutationObserver | null;
}

// 统一初始化：挂载 + 明暗跟随；返回 editor 与可断开的主题 observer
export async function createVditor(
	elId: string,
	opts: VditorMountOptions = {},
): Promise<VditorMountResult> {
	const { default: VditorClass } = await import("vditor");
	let observer: MutationObserver | null = null;
	const editor = new VditorClass(elId, {
		cdn: "/vditor",
		height: opts.height ?? 520,
		mode: "wysiwyg",
		value: opts.value ?? "",
		cache: { enable: false },
		...(opts.options || {}),
		after: () => {
			const root = document.querySelector<HTMLElement>(".vditor");
			if (root) {
				syncVditorTheme(root);
				observer = observeVditorTheme(root);
			}
		},
	});
	return { editor, observer };
}

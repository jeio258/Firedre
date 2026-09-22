// Vditor 后台明暗跟随：类同时加到 .vditor root 与 html（弹窗/面板在 body 末，需 html 继承）
const CONTENT_THEME_PATH =
	"https://cdn.jsdelivr.net/npm/vditor@3.11.3/dist/css/content-theme";

let vditorCtor: typeof import("vditor").default | null = null;

export function syncVditorTheme(root: HTMLElement): void {
	const dark = document.documentElement.classList.contains("dark");
	document.documentElement.classList.toggle("vditor--dark", dark);
	root.classList.toggle("vditor--dark", dark);
	// 内容区（表格/引用/代码块）颜色硬编码，靠官方 content-theme CSS 切换
	vditorCtor?.setContentTheme(dark ? "dark" : "light", CONTENT_THEME_PATH);
}

// 监听 html class 变化并同步当前 Vditor 实例
export function observeVditorTheme(root: HTMLElement): MutationObserver {
	const mo = new MutationObserver(() => syncVditorTheme(root));
	mo.observe(document.documentElement, {
		attributes: true,
		attributeFilter: ["class"],
	});
	return mo;
}

type VditorInstance = import("vditor").default;

// 后台发文高频项，精简到单行放得下（nexusdown 式单行工具栏）
const ADMIN_TOOLBAR = [
	"headings",
	"bold",
	"italic",
	"strike",
	"|",
	"quote",
	"list",
	"ordered-list",
	"check",
	"|",
	"inline-code",
	"code",
	"table",
	"link",
	"upload",
	"|",
	"undo",
	"redo",
	"edit-mode",
];

/** 统一的 Vditor 初始化：所见即所得模式 + 本地 CDN + 明暗主题跟随 */
export async function createAdminVditor(
	selector: string,
	options: {
		value: string;
		height: number;
		upload?: {
			url: string;
			fieldName: string;
			headers: Record<string, string>;
		};
		onThemeObserver: (mo: MutationObserver) => void;
	},
): Promise<VditorInstance> {
	const { default: Vditor } = await import("vditor");
	vditorCtor = Vditor;
	const dark = document.documentElement.classList.contains("dark");
	return new Vditor(selector, {
		height: options.height,
		mode: "wysiwyg",
		value: options.value,
		cdn: "https://cdn.jsdelivr.net/npm/vditor@3.11.3",
		cache: { enable: false },
		theme: dark ? "dark" : "classic",
		preview: {
			theme: { current: dark ? "dark" : "light", path: CONTENT_THEME_PATH },
			hljs: { style: dark ? "github-dark" : "github" },
		},
		toolbar: [...ADMIN_TOOLBAR],
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

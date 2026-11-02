// 后台 Markdown 编辑器（EasyMDE / CodeMirror 5）。
// 相比原富文本方案：无需 3.65MB 的 lute 解析器，首包 ~330KB；
// 纯 Markdown 源码 + 分屏预览，保存协议不变（组件侧仍拿 getValue 拼 frontmatter）。
import "easymde/dist/easymde.min.css";
// EasyMDE 工具栏图标是 fa-* 类名，必须引入 Font Awesome，否则按钮全空白
import "@fortawesome/fontawesome-free/css/all.min.css";
import "./admin-editor.css";

export interface AdminEditorUpload {
	url: string;
	fieldName: string;
	headers?: Record<string, string>;
}

export interface AdminEditorOptions {
	value: string;
	minHeight?: string;
	upload?: AdminEditorUpload;
}

export interface AdminEditor {
	getValue(): string;
	setValue(value: string): void;
	destroy(): void;
}

// easymde 是 CJS `export =`，动态导入的互操作形态在 Vite 下可能是 default 或命名空间本身
type EasyMDEClass = typeof import("easymde");
type EasyMDEOptions = NonNullable<ConstructorParameters<EasyMDEClass>[0]>;
type ToolbarArr = Exclude<EasyMDEOptions["toolbar"], boolean | undefined>;
type ToolbarItem = ToolbarArr extends readonly (infer T)[] ? T : never;

let EasyMDECtor: EasyMDEClass | null = null;

function buildToolbar(): ToolbarItem[] {
	return [
		"bold",
		"italic",
		"strikethrough",
		"heading-smaller",
		"heading-bigger",
		"|",
		"quote",
		"unordered-list",
		"ordered-list",
		"|",
		"code",
		"table",
		"link",
		"image",
		"|",
		"undo",
		"redo",
		"|",
		"preview",
		"side-by-side",
		"fullscreen",
	];
}

export async function createAdminEditor(
	elementId: string,
	options: AdminEditorOptions,
): Promise<AdminEditor> {
	const el = document.getElementById(elementId);
	if (!el) throw new Error(`编辑器容器不存在：#${elementId}`);

	// CJS 互操作：Vite 产物可能把类放在 default 或命名空间本身
	const mod = (await import("easymde")) as unknown as {
		default?: EasyMDEClass;
	} & EasyMDEClass;
	EasyMDECtor = (mod.default ?? mod) as EasyMDEClass;
	const EasyMDE = EasyMDECtor;
	const upload = options.upload;

	const instance = new EasyMDE({
		element: el as HTMLElement,
		initialValue: options.value,
		minHeight: options.minHeight ?? "480px",
		spellChecker: false,
		autosave: { enabled: false, uniqueId: "firedre-admin" },
		forceSync: true,
		sideBySideFullscreen: false,
		status: ["lines", "words"],
		toolbar: buildToolbar(),
		...(upload
			? {
					uploadImage: true,
					imageUploadFunction: (
						file: File,
						onSuccess: (url: string) => void,
						onError: (err: string) => void,
					) => {
						const fd = new FormData();
						fd.append(upload.fieldName, file);
						fetch(upload.url, {
							method: "POST",
							credentials: "same-origin",
							headers: upload.headers,
							body: fd,
						})
							.then((r) => r.json().catch(() => null))
							.then((d) => {
								if (d?.url) onSuccess(d.url as string);
								else onError((d?.message as string) || "上传失败");
							})
							.catch((e) => onError(String(e)));
					},
					imageTexts: {
						sbInit: "拖拽/粘贴/点击工具栏图片按钮上传",
						sbOnDragEnter: "松开即可上传",
						sbOnDrop: "上传中…",
						sbProgress: "上传中 {progress}%",
						sbOnUploaded: "上传完成",
					},
				}
			: {}),
	});

	return {
		getValue: () => instance.value(),
		setValue: (value: string) => instance.value(value),
		destroy: () => {
			try {
				instance.cleanup();
			} catch {
				// 组件卸载时 DOM 已移除，清理失败可忽略
			}
		},
	};
}

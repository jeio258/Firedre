// 顶栏「保存全部」的统一注册中心：各编辑器挂载时登记自己的保存逻辑与中文名称
import { setDraft } from "./adminDrafts";

export type SaveHandler = () => void | Promise<void>;

// 以面板名为键，避免重复注册互相覆盖；同名重注册自动取最新
const handlers = new Map<string, SaveHandler>();

// 当前挂载面板（用于切换时暂存草稿）
let activeLabel = "";
let activeCollect: (() => unknown) | null = null;

/** 登记当前视图的保存逻辑，返回注销函数（交给 onMount 清理）。
 * collect 可选：返回可序列化草稿，供切换面板前暂存、回来后恢复。 */
export function registerSaveAll(
	label: string,
	handler: SaveHandler,
	collect?: () => unknown,
): () => void {
	handlers.set(label, handler);
	activeLabel = label;
	activeCollect = collect ?? null;
	return () => {
		if (handlers.get(label) === handler) handlers.delete(label);
		if (activeLabel === label) {
			activeLabel = "";
			activeCollect = null;
		}
	};
}

/** 切换面板前调用：把当前面板草稿暂存，避免未保存编辑丢失 */
export function persistActiveDraft(): void {
	if (activeCollect) setDraft(activeLabel, activeCollect());
}

/** 顶栏按钮调用：执行所有已登记的保存逻辑，返回每项成败与对应面板名 */
export type SaveResult = { label: string; ok: boolean; error?: unknown };

export function runSaveAll(): Promise<SaveResult[]> {
	return Promise.all(
		[...handlers].map(async ([label, handler]) => {
			try {
				await handler();
				return { label, ok: true } as SaveResult;
			} catch (e) {
				console.error("[save-all]", label, e);
				return { label, ok: false, error: e } as SaveResult;
			}
		}),
	);
}

// 顶栏「保存全部」的统一注册中心：各编辑器挂载时登记自己的保存逻辑
type SaveHandler = () => void | Promise<void>;

const handlers = new Set<SaveHandler>();

/** 登记当前视图的保存逻辑，返回注销函数（交给 onMount 清理） */
export function registerSaveAll(handler: SaveHandler): () => void {
	handlers.add(handler);
	return () => handlers.delete(handler);
}

/** 顶栏按钮调用：执行所有已登记的保存逻辑，返回每项成败 */
export type SaveResult = { ok: boolean; error?: unknown };

export function runSaveAll(): Promise<SaveResult[]> {
	return Promise.all(
		[...handlers].map(async (handler) => {
			try {
				await handler();
				return { ok: true } as SaveResult;
			} catch (e) {
				console.error("[save-all]", e);
				return { ok: false, error: e } as SaveResult;
			}
		}),
	);
}

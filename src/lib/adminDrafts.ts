// 后台面板草稿暂存：切换面板/路由时不丢未保存的编辑，回到该面板自动恢复
const store = new Map<string, unknown>();

export function setDraft(label: string, data: unknown): void {
	store.set(label, data);
}
export function getDraft<T = unknown>(label: string): T | undefined {
	return store.get(label) as T | undefined;
}
export function clearDraft(label: string): void {
	store.delete(label);
}
export function hasDraft(label: string): boolean {
	return store.has(label);
}

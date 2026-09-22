import { onMount } from "svelte";

/**
 * svelte-check 4.7.6 + TS6 对 `onMount(async () => { …; return cleanup })` 存在误报
 * （最小复现已证，合法 Svelte5 模式）；本包装保持挂载/卸载清理语义。
 */
export function onMountAsync(work: () => Promise<() => void>): void {
	onMount(() => {
		const pending = work();
		return () => {
			void pending.then((cleanup) => cleanup());
		};
	});
}

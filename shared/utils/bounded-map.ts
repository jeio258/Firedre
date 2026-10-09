// 有界 Map 清理：长驻 isolate 内以 IP / 键为索引的限流桶会只增不减 → 内存无界增长。
// 超过上限时先删除已过期项（resetAt <= now），仍超上限则整体清空，保证内存有界。
export function pruneBoundedMap<V extends { resetAt: number }>(
	map: Map<string, V>,
	now: number,
	max: number,
): void {
	if (map.size < max) return;
	for (const [key, value] of map) {
		if (value.resetAt <= now) map.delete(key);
	}
	// 极端：窗口内活跃 key 已超上限 → 整体清空（限流为尽力而为，优先保证内存有界）
	if (map.size >= max) map.clear();
}

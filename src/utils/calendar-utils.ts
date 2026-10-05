// Calendar 组件的纯逻辑（自组件拆分，无 DOM/组件状态依赖，可复用、可单测）。

/** 统一的日期键约定：YYYY-MM-DD（monthIndex 为 0-11，与 Date#getMonth 一致） */
export function toDateKey(
	year: number,
	monthIndex: number,
	day: number,
): string {
	return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** 热力图计数：按「月 × 周（每月 4 周，第 4 周吸收月末剩余天）」聚合同年文章数 */
export function buildHeatmapCounts(
	posts: Array<{ published: string }>,
	year: number,
): number[][] {
	const heatmapData = Array.from({ length: 12 }, () => [0, 0, 0, 0]);
	posts.forEach((post) => {
		const date = new Date(post.published);
		if (date.getFullYear() !== year) return;
		const month = date.getMonth();
		const day = date.getDate();
		const week = Math.min(Math.floor((day - 1) / 7), 3); // 0-3
		heatmapData[month][week]++;
	});
	return heatmapData;
}

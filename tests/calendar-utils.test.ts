import { describe, expect, it } from "vitest";
import { buildHeatmapCounts, toDateKey } from "../src/utils/calendar-utils";

describe("calendar-utils（自 Calendar 组件抽取的纯逻辑）", () => {
	it("toDateKey 补零格式与月份 1 基一致", () => {
		expect(toDateKey(2026, 0, 1)).toBe("2026-01-01");
		expect(toDateKey(2026, 11, 31)).toBe("2026-12-31");
		expect(toDateKey(2026, 8, 9)).toBe("2026-09-09");
	});

	it("buildHeatmapCounts 只统计指定年份，且第 4 周吸收月末", () => {
		const posts = [
			{ published: "2026-01-01T00:00:00Z" }, // 1 月第 1 周
			{ published: "2026-01-08T00:00:00Z" }, // 1 月第 2 周
			{ published: "2026-01-29T00:00:00Z" }, // 1 月第 5 周 → 归入第 4 周
			{ published: "2025-01-01T00:00:00Z" }, // 其它年份 → 不计
		];
		const grid = buildHeatmapCounts(posts, 2026);
		expect(grid).toHaveLength(12);
		expect(grid[0]).toEqual([1, 1, 0, 1]);
		expect(grid[1]).toEqual([0, 0, 0, 0]);
	});

	it("空数据返回全零 12×4 网格", () => {
		const grid = buildHeatmapCounts([], 2026);
		expect(grid.every((m) => m.length === 4 && m.every((n) => n === 0))).toBe(
			true,
		);
	});
});

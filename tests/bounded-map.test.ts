import { describe, expect, it } from "vitest";
import { pruneBoundedMap } from "../shared/utils/bounded-map";

const E = (resetAt: number) => ({ resetAt });

describe("pruneBoundedMap（P9 有界清理）", () => {
	it("未达上限 → 不清理", () => {
		const m = new Map([["a", E(0)]]);
		pruneBoundedMap(m, 1000, 5);
		expect(m.size).toBe(1);
	});

	it("达上限 → 仅删除已过期项", () => {
		const m = new Map([
			["old1", E(500)],
			["old2", E(1000)], // resetAt <= now → 过期
			["new1", E(2000)],
			["new2", E(3000)],
		]);
		pruneBoundedMap(m, 1000, 4);
		expect([...m.keys()].sort()).toEqual(["new1", "new2"]);
	});

	it("达上限且全部未过期 → 整体清空（保证有界）", () => {
		const m = new Map([
			["a", E(2000)],
			["b", E(3000)],
		]);
		pruneBoundedMap(m, 1000, 2);
		expect(m.size).toBe(0);
	});
});

import { describe, expect, it } from "vitest";
import type { SakuraConfig } from "../src/types/effectsConfig";
import { createSakuraRandom } from "../src/utils/sakura-random";

const cfg = {
	size: { min: 2, max: 4 },
	opacity: { min: 0.1, max: 0.9 },
	speed: {
		horizontal: { min: 1, max: 2 },
		vertical: { min: 1, max: 2 },
		rotation: 0.5,
		fadeSpeed: 2,
	},
} as unknown as SakuraConfig;

describe("createSakuraRandom（R3 主线程/Worker 共用逻辑）", () => {
	it("x/y 使用注入的尺寸", () => {
		const r = createSakuraRandom(() => ({ width: 100, height: 50 }));
		const x = r("x", cfg);
		const y = r("y", cfg);
		expect(x).toBeGreaterThanOrEqual(0);
		expect(x).toBeLessThan(100);
		expect(y).toBeGreaterThanOrEqual(0);
		expect(y).toBeLessThan(50);
	});

	it("s/r/a 落在配置区间", () => {
		const r = createSakuraRandom(() => ({ width: 1, height: 1 }));
		const s = r("s", cfg);
		expect(s).toBeGreaterThanOrEqual(2);
		expect(s).toBeLessThan(4);
		expect(r("r", cfg)).toBeLessThan(6);
		const a = r("a", cfg);
		expect(a).toBeGreaterThanOrEqual(0.1);
		expect(a).toBeLessThan(0.9);
	});

	it("fn* 返回确定性变换函数", () => {
		const r = createSakuraRandom(() => ({ width: 1, height: 1 }));
		const fnx = r("fnx", cfg);
		const fny = r("fny", cfg);
		const fnr = r("fnr", cfg);
		const fna = r("fna", cfg);
		expect(fnx(10, 0)).toBeGreaterThanOrEqual(10);
		expect(fny(0, 10)).toBeGreaterThanOrEqual(10);
		expect(fnr(1)).toBeCloseTo(1.5); // 1 + rotation(0.5)
		expect(fna(1)).toBeCloseTo(0.98); // 1 - fadeSpeed(2)*0.01
	});
});

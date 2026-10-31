import { describe, expect, it } from "vitest";
import {
	KATEX_ASSET_VERSION,
	katexStylesheetPath,
} from "../src/lib/katexAssets";

describe("katex 资产版本化（P14）", () => {
	it("样式表路径带版本查询串（缓存失效）", () => {
		const p = katexStylesheetPath();
		expect(p).toBe(`/katex/katex.min.css?v=${KATEX_ASSET_VERSION}`);
		expect(p).toContain("?v=");
	});

	it("版本常量为非空字符串", () => {
		expect(typeof KATEX_ASSET_VERSION).toBe("string");
		expect(KATEX_ASSET_VERSION.length).toBeGreaterThan(0);
	});
});

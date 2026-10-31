import { describe, expect, it } from "vitest";
import { buildHtmlCacheKey } from "../src/lib/htmlCacheKey";

describe("buildHtmlCacheKey（P12：键不含 query）", () => {
	it("跟踪参数不改变缓存键（避免恒 miss）", () => {
		const a = buildHtmlCacheKey(new URL("https://x/posts/a/"), "v1");
		const b = buildHtmlCacheKey(
			new URL("https://x/posts/a/?utm_source=fb&fbclid=1"),
			"v1",
		);
		expect(b).toBe(a);
	});

	it("path / 版本不同 → 键不同", () => {
		const base = buildHtmlCacheKey(new URL("https://x/posts/a/"), "v1");
		expect(buildHtmlCacheKey(new URL("https://x/posts/b/"), "v1")).not.toBe(
			base,
		);
		expect(buildHtmlCacheKey(new URL("https://x/posts/a/"), "v2")).not.toBe(
			base,
		);
	});

	it("键为绝对 URL，含 __html_cache__ 与版本段", () => {
		const k = buildHtmlCacheKey(new URL("https://x/posts/a/"), "v1");
		// 沿用既有格式（__html_cache__ 后紧跟 pathname → 双斜杠）
		expect(k).toBe("https://x/__html_cache__//posts/a/?v=v1");
		expect(() => new URL(k)).not.toThrow();
	});
});

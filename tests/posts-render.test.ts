import { describe, it, expect } from "vitest";
import { renderMarkdown } from "../server/posts/render";

describe("renderMarkdown 渲染管线", () => {
	it("渲染标题/强调/链接/代码", async () => {
		const out = await renderMarkdown(
			"# 标题一\n\n**加粗** 与 [链接](https://example.com)\n\n`code()`\n",
			{},
		);
		expect(out.html).toContain("<h1");
		expect(out.html).toContain("<strong>加粗</strong>");
		expect(out.html).toContain('href="https://example.com"');
		expect(out.html).toContain("<code>code()</code>");
		expect(out.headings.some((h) => h.text?.includes("标题一"))).toBe(true);
	});

	it("不执行 script 标签（净化生效）", async () => {
		const out = await renderMarkdown(
			"前文\n\n<script>alert(1)</script>\n\n后文\n",
			{},
		);
		expect(out.html).not.toContain("<script");
		expect(out.html).toContain("后文");
	});
});

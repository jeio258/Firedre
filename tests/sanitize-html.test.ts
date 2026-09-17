import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { type Browser, chromium, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// sanitizeDynamicHtml 依赖真实 DOM（NamedNodeMap 语义），故打包生产源码后注入真实浏览器执行
const SOURCE = fileURLToPath(
	new URL("../src/utils/sanitize-html.ts", import.meta.url),
);

type SanitizerGlobal = {
	__SANITIZE__?: { sanitizeDynamicHtml(input: string): string };
};

let browser: Browser | undefined;
let page: Page | undefined;

beforeAll(async () => {
	const bundled = await build({
		entryPoints: [SOURCE],
		bundle: true,
		format: "iife",
		globalName: "__SANITIZE__",
		platform: "browser",
		write: false,
	});
	browser = await chromium.launch();
	page = await browser.newPage();
	await page.addScriptTag({ content: bundled.outputFiles?.[0]?.text ?? "" });
}, 120_000);

afterAll(async () => {
	await browser?.close();
});

async function sanitize(html: string): Promise<string> {
	if (!page) throw new Error("浏览器未初始化");
	return page.evaluate((input) => {
		const api = (globalThis as unknown as SanitizerGlobal).__SANITIZE__;
		return api ? api.sanitizeDynamicHtml(input) : "";
	}, html);
}

describe("sanitizeDynamicHtml（动态内容客户端消毒，真实浏览器）", () => {
	it("剥离 onerror 事件属性", async () => {
		const out = await sanitize(
			'<img src="https://a.com/x.png" onerror="alert(1)">',
		);
		expect(out).not.toContain("onerror");
		expect(out).toContain('src="https://a.com/x.png"');
	});

	it("剥离 javascript: 协议 URL", async () => {
		const out = await sanitize('<a href="javascript:alert(1)">x</a>');
		expect(out).not.toContain("javascript:");
		expect(out).toContain("x");
	});

	it("剥离内联 style", async () => {
		const out = await sanitize('<span style="position:fixed;inset:0">x</span>');
		expect(out).not.toContain("style=");
		expect(out).toContain("x");
	});

	it("剥离 srcdoc", async () => {
		const out = await sanitize('<div srcdoc="x">y</div>');
		expect(out).not.toContain("srcdoc");
		expect(out).toContain("y");
	});

	it("移除 script 标签本身但保留其文本", async () => {
		const out = await sanitize("<script>alert(1)</script><p>ok</p>");
		expect(out).not.toContain("<script");
		expect(out).toContain("<p>ok</p>");
	});

	it("保留白名单属性", async () => {
		const out = await sanitize(
			'<a href="https://ok.com/" title="hi" class="c">x</a>',
		);
		expect(out).toContain('href="https://ok.com/"');
		expect(out).toContain('title="hi"');
		expect(out).toContain('class="c"');
	});
});

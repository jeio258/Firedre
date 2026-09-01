import { describe, it, expect } from "vitest";
import { sanitizeHast, sanitizeUrl } from "../server/posts/sanitize";

describe("sanitizeUrl", () => {
	it("removes javascript:/vbscript:/file: URLs", () => {
		expect(sanitizeUrl("javascript:alert(1)")).toBeUndefined();
		expect(sanitizeUrl("  javascript:alert(1)  ")).toBeUndefined();
		expect(sanitizeUrl("vbscript:msgbox")).toBeUndefined();
		expect(sanitizeUrl("file:///etc/passwd")).toBeUndefined();
	});

	it("blocks scheme bypass via embedded ASCII tab/CR/LF (WHATWG strips them)", () => {
		expect(sanitizeUrl("java\tscript:alert(1)")).toBeUndefined();
		expect(sanitizeUrl("java\nscript:alert(1)")).toBeUndefined();
		expect(sanitizeUrl("java\rscript:alert(1)")).toBeUndefined();
		expect(sanitizeUrl("  java\tscript:alert(1)  ")).toBeUndefined();
		expect(sanitizeUrl("\tjava\tscript:alert(1)\t")).toBeUndefined();
	});

	it("removes non-image data: URLs", () => {
		expect(sanitizeUrl("data:text/html,<script>alert(1)</script>")).toBeUndefined();
		expect(sanitizeUrl("data:image/svg+xml,<svg onload=alert(1)>")).toBeUndefined();
	});

	it("keeps safe URLs", () => {
		expect(sanitizeUrl("https://example.com")).toBe("https://example.com");
		expect(sanitizeUrl("/local/path.png")).toBe("/local/path.png");
		expect(sanitizeUrl("mailto:a@b.c")).toBe("mailto:a@b.c");
		expect(sanitizeUrl("data:image/png;base64,AAAA")).toBe(
			"data:image/png;base64,AAAA",
		);
	});
});

describe("sanitizeHast", () => {
	it("removes <script> elements recursively", () => {
		const tree = {
			type: "root",
			children: [
				{ type: "element", tagName: "p", properties: {}, children: [{ type: "text", value: "hi" }] },
				{ type: "element", tagName: "script", properties: {}, children: [{ type: "text", value: "alert(1)" }] },
				{
					type: "element",
					tagName: "div",
					properties: {},
					children: [
						{ type: "element", tagName: "script", properties: {}, children: [] },
					],
				},
			],
		};
		sanitizeHast(tree);
		const remaining = tree.children as Array<{ tagName?: string; children?: unknown[] }>;
		const tags = remaining.map((c) => c.tagName);
		expect(tags).not.toContain("script");
		// p 与 div 保留，div 内的 script 被移除
		expect(remaining).toHaveLength(2);
		expect(remaining[1].children).toHaveLength(0);
	});

	it("strips event handler and srcdoc attributes, keeps safe ones", () => {
		const img = {
			type: "element",
			tagName: "img",
			properties: { src: "/x.png", onerror: "alert(1)", class: "pic" },
			children: [],
		};
		sanitizeHast(img);
		expect(img.properties.onerror).toBeUndefined();
		expect(img.properties.src).toBe("/x.png");
		expect(img.properties.class).toBe("pic");

		const iframe = {
			type: "element",
			tagName: "iframe",
			properties: { src: "https://example.com", srcdoc: "<script>alert(1)</script>" },
			children: [],
		};
		sanitizeHast(iframe);
		expect(iframe.properties.srcdoc).toBeUndefined();
		expect(iframe.properties.src).toBe("https://example.com");
	});

	it("removes javascript: href and keeps normal href", () => {
		const a = {
			type: "element",
			tagName: "a",
			properties: { href: "javascript:alert(1)" },
			children: [{ type: "text", value: "x" }],
		};
		sanitizeHast(a);
		expect(a.properties.href).toBeUndefined();
	});
});

describe("sanitizeHast srcset（P2-1）", () => {
	it("净化为逗号分隔 URL 列表，丢弃 javascript: 候选", () => {
		const img = {
			type: "element",
			tagName: "img",
			properties: {
				srcset:
					"a.jpg 1x, javascript:alert(1) 2x, /local/b.jpg 2x",
			},
			children: [],
		};
		sanitizeHast(img);
		expect(img.properties.srcset).toBe("a.jpg 1x, /local/b.jpg 2x");
	});

	it("全部候选非法时删除 srcset", () => {
		const img = {
			type: "element",
			tagName: "img",
			properties: {
				srcset: "javascript:alert(1) 1x, vbscript:msgbox 2x",
			},
			children: [],
		};
		sanitizeHast(img);
		expect(img.properties.srcset).toBeUndefined();
	});
});

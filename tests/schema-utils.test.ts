import { describe, it, expect } from "vitest";
import { safeJsonLd, toAbsoluteUrl } from "../src/utils/schema-utils";

describe("schema-utils.toAbsoluteUrl 对裸域名 base 的防御", () => {
	it("base 为裸域名（无协议）时不抛 Invalid URL，并补全 https://", () => {
		// 后台 siteUrl 可填 www.994613.xyz（无协议）；修复前 new URL(base) 抛错导致 SSR 白屏
		const url = toAbsoluteUrl("/about/", "www.994613.xyz");
		expect(url).toBe("https://www.994613.xyz/about/");
	});

	it("base 已带协议时正常工作", () => {
		const url = toAbsoluteUrl("/about/", "https://example.com");
		expect(url).toBe("https://example.com/about/");
	});

	it("src 为绝对 URL 时原样返回，不依赖 base", () => {
		const url = toAbsoluteUrl("https://cdn.example.com/x.png", "www.994613.xyz");
		expect(url).toBe("https://cdn.example.com/x.png");
	});

	it("src 为空时返回 null", () => {
		expect(toAbsoluteUrl(null, "https://example.com")).toBeNull();
	});
});

describe("schema-utils.safeJsonLd 防止 </script> 逃逸", () => {
	it("转义 < 为 \\u003c，阻止标题闭合 script 标签", () => {
		const json = safeJsonLd({ title: "</script><script>alert(1)</script>" });
		expect(json).not.toContain("</script>");
		expect(json).toContain("\\u003c/script\\u003e");
	});

	it("转义 > 与 &", () => {
		const json = safeJsonLd({ name: "a > b & c" });
		expect(json).toContain("\\u003e");
		expect(json).toContain("\\u0026");
	});

	it("正常数据序列化保持不变（除安全转义）", () => {
		const json = safeJsonLd({ slug: "guide/hello", ok: true });
		expect(JSON.parse(json)).toEqual({ slug: "guide/hello", ok: true });
	});
});

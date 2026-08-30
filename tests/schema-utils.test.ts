import { describe, it, expect } from "vitest";
import { toAbsoluteUrl } from "../src/utils/schema-utils";

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

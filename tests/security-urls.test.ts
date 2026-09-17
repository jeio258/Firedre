import { describe, it, expect } from "vitest";
import { isSafeHttpUrl } from "../server/friends/service";
import { isSafeNoticeUrl } from "../server/notice/normalize";

describe("friends.isSafeHttpUrl 拦截危险 scheme（存储型 XSS）", () => {
	it("拒绝 javascript:/data:/vbscript:", () => {
		expect(isSafeHttpUrl("javascript:alert(1)")).toBe(false);
		expect(isSafeHttpUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
		expect(isSafeHttpUrl("vbscript:msgbox")).toBe(false);
	});

	it("允许 http/https 与相对路径", () => {
		expect(isSafeHttpUrl("https://example.com")).toBe(true);
		expect(isSafeHttpUrl("http://example.com/avatar.png")).toBe(true);
		expect(isSafeHttpUrl("/local/avatar.png")).toBe(true);
		expect(isSafeHttpUrl("example.com")).toBe(true);
	});

	it("拒绝空串", () => {
		expect(isSafeHttpUrl("")).toBe(false);
	});
});

describe("notice.isSafeNoticeUrl 拦截危险 scheme", () => {
	it("拒绝 javascript: 与 data:", () => {
		expect(isSafeNoticeUrl("javascript:alert(1)")).toBe(false);
		expect(isSafeNoticeUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
	});

	it("允许 http/https/mailto/tel 与相对路径", () => {
		expect(isSafeNoticeUrl("https://example.com")).toBe(true);
		expect(isSafeNoticeUrl("mailto:a@b.c")).toBe(true);
		expect(isSafeNoticeUrl("tel:10086")).toBe(true);
		expect(isSafeNoticeUrl("/about/")).toBe(true);
	});
});

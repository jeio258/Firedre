import { describe, expect, it } from "vitest";
import { isSafeHttpUrl } from "../server/friends/service";
import { isSafeNoticeUrl } from "../server/notice/normalize";
import {
	isSafeProxyTarget,
	resolveSafeRedirect,
} from "../server/utils/safeUrl";

describe("friends.isSafeHttpUrl 拦截危险 scheme（存储型 XSS）", () => {
	it("拒绝 javascript:/data:/vbscript:", () => {
		expect(isSafeHttpUrl("javascript:alert(1)")).toBe(false);
		expect(isSafeHttpUrl("data:text/html,<script>alert(1)</script>")).toBe(
			false,
		);
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
		expect(isSafeNoticeUrl("data:text/html,<script>alert(1)</script>")).toBe(
			false,
		);
	});

	it("允许 http/https/mailto/tel 与相对路径", () => {
		expect(isSafeNoticeUrl("https://example.com")).toBe(true);
		expect(isSafeNoticeUrl("mailto:a@b.c")).toBe(true);
		expect(isSafeNoticeUrl("tel:10086")).toBe(true);
		expect(isSafeNoticeUrl("/about/")).toBe(true);
	});
});

describe("safeUrl.isSafeProxyTarget 阻断 cover-proxy 的 SSRF 危险目标", () => {
	const allow = [
		"https://t.alcy.cc/pc",
		"https://example.com/a.png",
		"https://8.8.8.8/x",
		"https://[2606:4700::1]/x",
	];
	const block = [
		"https://127.0.0.1/x",
		"https://10.0.0.5/x",
		"https://172.16.0.1/x",
		"https://192.168.1.1/x",
		"https://169.254.169.254/latest/meta-data/",
		"https://100.64.0.1/x",
		"https://0.0.0.0/x",
		"https://2130706433/x", // WHATWG 归一为 127.0.0.1
		"https://[::1]/x",
		"https://[fd00::1]/x",
		"https://[fe80::1]/x",
		"https://[::ffff:127.0.0.1]/x",
		"https://localhost/x",
		"https://foo.local/x",
		"https://host.internal/x",
	];
	it("放行公网图片主机（含公网 IP）", () => {
		for (const u of allow) expect(isSafeProxyTarget(new URL(u)), u).toBe(true);
	});
	it("阻断私网/环回/链路本地/元数据与保留 TLD", () => {
		for (const u of block) expect(isSafeProxyTarget(new URL(u)), u).toBe(false);
	});
});

describe("safeUrl.resolveSafeRedirect 重定向逐跳校验（cover-proxy）", () => {
	const cur = new URL("https://t.alcy.cc/pc");

	it("✅ 相对 Location 按当前 URL 解析（真实图源 t.alcy.cc 的形态）", () => {
		expect(resolveSafeRedirect(cur, "/pic/pc/548.webp")?.href).toBe(
			"https://t.alcy.cc/pic/pc/548.webp",
		);
	});

	it("✅ 允许跳向另一个公网 https 主机", () => {
		expect(
			resolveSafeRedirect(cur, "https://cdn.example.com/a.webp")?.href,
		).toBe("https://cdn.example.com/a.webp");
	});

	it("⛔ 阻断跳向私网/环回/元数据/localhost/保留 TLD", () => {
		for (const loc of [
			"https://127.0.0.1/x",
			"https://10.0.0.5/x",
			"https://192.168.1.1/x",
			"https://169.254.169.254/latest/meta-data/",
			"https://[::1]/x",
			"https://localhost/x",
			"https://host.internal/x",
		]) {
			expect(resolveSafeRedirect(cur, loc), loc).toBeNull();
		}
	});

	it("⛔ 阻断非 https 与无法解析的 Location", () => {
		expect(resolveSafeRedirect(cur, "http://example.com/x")).toBeNull();
		expect(resolveSafeRedirect(cur, "https://")).toBeNull();
	});
});

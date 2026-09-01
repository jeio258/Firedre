import { describe, it, expect } from "vitest";
import { isSafeHttpUrl } from "../server/friends/service";
import { isSafeNoticeUrl } from "../server/notice/normalize";
import { verifyAlbumAccess } from "../utils/albumAuth";

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

describe("album 锁门依据 = D1 密码存在性（P1-3 WebDAV 脱同步防护）", () => {
	it("D1 密码存在即上锁：无 accessPassword 拒绝", () => {

		expect(verifyAlbumAccess({ encrypted: true, password: "secret", accessPassword: "" })).toBe(false);
	});

	it("密码正确时放行", () => {
		expect(verifyAlbumAccess({ encrypted: true, password: "secret", accessPassword: "secret" })).toBe(true);
	});

	it("密码错误时拒绝", () => {
		expect(verifyAlbumAccess({ encrypted: true, password: "secret", accessPassword: "wrong" })).toBe(false);
	});

	it("D1 密码缺失（未上锁）时无条件放行", () => {
		expect(verifyAlbumAccess({ encrypted: false, password: "", accessPassword: "" })).toBe(true);
	});
});

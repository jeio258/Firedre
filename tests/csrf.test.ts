import { describe, expect, it } from "vitest";
import {
	isSameOriginRequest,
	originForbiddenResponse,
} from "../server/utils/csrf";

const URL_UNDER_TEST = "https://site.test/api/auth/register/";

function build(
	method: string,
	headers: { origin?: string; site?: string } = {},
): Request {
	const h = new Headers();
	if (headers.origin !== undefined) h.set("Origin", headers.origin);
	if (headers.site !== undefined) h.set("Sec-Fetch-Site", headers.site);
	return new Request(URL_UNDER_TEST, { method, headers: h });
}

describe("isSameOriginRequest 安全方法", () => {
	it("GET / HEAD / OPTIONS 一律放行（跨站 Origin 也不拦）", () => {
		expect(
			isSameOriginRequest(build("GET", { origin: "https://evil.test" })),
		).toBe(true);
		expect(
			isSameOriginRequest(build("HEAD", { origin: "https://evil.test" })),
		).toBe(true);
		expect(isSameOriginRequest(build("OPTIONS", { site: "cross-site" }))).toBe(
			true,
		);
	});
});

describe("isSameOriginRequest 写方法 + Origin", () => {
	it("同源 Origin 放行", () => {
		expect(
			isSameOriginRequest(build("POST", { origin: "https://site.test" })),
		).toBe(true);
	});

	it("跨站 Origin 拒绝", () => {
		expect(
			isSameOriginRequest(build("POST", { origin: "https://evil.test" })),
		).toBe(false);
		expect(
			isSameOriginRequest(build("DELETE", { origin: "http://site.test" })),
		).toBe(false);
	});

	it("端口或子域不同都算跨站", () => {
		expect(
			isSameOriginRequest(build("POST", { origin: "https://site.test:8443" })),
		).toBe(false);
		expect(
			isSameOriginRequest(build("POST", { origin: "https://api.site.test" })),
		).toBe(false);
	});

	it("Origin 无法解析为 URL 时拒绝", () => {
		expect(isSameOriginRequest(build("POST", { origin: "site.test" }))).toBe(
			false,
		);
		expect(isSameOriginRequest(build("POST", { origin: ":::" }))).toBe(false);
	});
});

describe("isSameOriginRequest 无可用 Origin", () => {
	it("Origin: null（沙箱 iframe）跨站时拒绝", () => {
		expect(
			isSameOriginRequest(
				build("POST", { origin: "null", site: "cross-site" }),
			),
		).toBe(false);
	});

	it("Origin: null 且无 Sec-Fetch-Site 时放行（无 Cookie 可冒用的非浏览器客户端）", () => {
		expect(isSameOriginRequest(build("POST", { origin: "null" }))).toBe(true);
	});

	it("无 Origin 但 Sec-Fetch-Site 为跨站 → 拒绝", () => {
		expect(isSameOriginRequest(build("POST", { site: "cross-site" }))).toBe(
			false,
		);
		expect(isSameOriginRequest(build("POST", { site: "same-site" }))).toBe(
			false,
		);
	});

	it("无 Origin 且 Sec-Fetch-Site 同源或直输 → 放行", () => {
		expect(isSameOriginRequest(build("POST", { site: "same-origin" }))).toBe(
			true,
		);
		expect(isSameOriginRequest(build("POST", { site: "none" }))).toBe(true);
	});

	it("两者都没有（curl / 服务端调用）→ 放行", () => {
		expect(isSameOriginRequest(build("POST"))).toBe(true);
	});
});

describe("originForbiddenResponse", () => {
	it("返回 403 + JSON + 不缓存", async () => {
		const res = originForbiddenResponse();

		expect(res.status).toBe(403);
		expect(res.headers.get("Content-Type")).toBe(
			"application/json; charset=utf-8",
		);
		expect(res.headers.get("Cache-Control")).toBe("no-store");
		expect(await res.json()).toEqual({ message: "跨站请求被拒绝" });
	});
});

import { describe, expect, it } from "vitest";
import {
	buildHitHeaders,
	buildStoredHeaders,
	isCacheableResponse,
	withProxyGuard,
} from "../src/lib/proxyCache";

const res = (status: number) => new Response(null, { status });

describe("isCacheableResponse（仅 2xx 入缓存）", () => {
	it("2xx 可缓存", () => {
		for (const status of [200, 201, 204, 206]) {
			expect(isCacheableResponse(res(status))).toBe(true);
		}
	});

	it("4xx/5xx 不可缓存（避免固化配置错误/上游故障）", () => {
		for (const status of [400, 401, 403, 404, 429, 500, 502, 503]) {
			expect(isCacheableResponse(res(status))).toBe(false);
		}
	});

	it("3xx 不缓存", () => {
		for (const status of [301, 302, 304]) {
			expect(isCacheableResponse(res(status))).toBe(false);
		}
	});
});

describe("withProxyGuard 契约", () => {
	const req = () => new Request("https://example.com/api/bilibili?uid=1");
	const url = () => new URL("https://example.com/api/bilibili?uid=1");

	it("原样返回 handler 响应（DEV 下不进缓存）", async () => {
		const out = await withProxyGuard(
			req(),
			url(),
			async () =>
				new Response(JSON.stringify({ ok: true }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				}),
		);
		expect(out.status).toBe(200);
		expect(await out.text()).toContain("ok");
	});

	it("错误响应同样原样返回，不被吞掉", async () => {
		const out = await withProxyGuard(
			req(),
			url(),
			async () => new Response(JSON.stringify({ error: "x" }), { status: 400 }),
		);
		expect(out.status).toBe(400);
	});
});

describe("代理缓存头（P1-F3：命中还原 handler 的浏览器缓存语义）", () => {
	const origin = (cc?: string) => {
		const h = new Headers({ "Content-Type": "application/json" });
		if (cc) h.set("Cache-Control", cc);
		return h;
	};

	it("存储时改用边缘 TTL，并把原 Cache-Control 另存于内部头", () => {
		const stored = buildStoredHeaders(origin("private, no-store"));
		expect(stored.get("Cache-Control")).toBe("public, max-age=300");
		expect(stored.get("X-Firedre-Origin-Cache-Control")).toBe(
			"private, no-store",
		);
		expect(stored.get("X-Firedre-Cache")).toBe("MISS");
	});

	it("命中往返：还原 handler 的 Cache-Control，且不泄漏内部头", () => {
		const hit = buildHitHeaders(
			buildStoredHeaders(origin("private, no-store")),
		);
		expect(hit.get("Cache-Control")).toBe("private, no-store");
		expect(hit.get("X-Firedre-Origin-Cache-Control")).toBeNull();
		expect(hit.get("X-Firedre-Cache")).toBe("HIT");
	});

	it("handler 未设 Cache-Control：命中保持边缘 TTL（旧条目兼容）", () => {
		const stored = buildStoredHeaders(origin());
		expect(stored.get("X-Firedre-Origin-Cache-Control")).toBeNull();
		const hit = buildHitHeaders(stored);
		expect(hit.get("Cache-Control")).toBe("public, max-age=300");
		expect(hit.get("X-Firedre-Origin-Cache-Control")).toBeNull();
	});
});

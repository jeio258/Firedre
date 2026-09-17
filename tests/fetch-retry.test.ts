import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchWithRetry } from "../server/utils/fetchRetry";

const originalFetch = globalThis.fetch;

afterEach(() => {
	vi.restoreAllMocks();
	globalThis.fetch = originalFetch;
});

describe("fetchWithRetry", () => {
	it("首次成功直接返回", async () => {
		globalThis.fetch = vi.fn(async () => new Response("ok", { status: 200 }));
		const res = await fetchWithRetry("https://x/", {}, { backoffMs: 1 });
		expect(res.status).toBe(200);
		expect(globalThis.fetch).toHaveBeenCalledTimes(1);
	});

	it("5xx 重试后成功", async () => {
		let calls = 0;
		globalThis.fetch = vi.fn(async () => {
			calls += 1;
			return new Response("err", { status: calls === 1 ? 503 : 200 });
		});
		const res = await fetchWithRetry("https://x/", {}, { retries: 2, backoffMs: 1 });
		expect(res.status).toBe(200);
		expect(calls).toBe(2);
	});

	it("重试耗尽后返回末次 5xx 响应（由调用方处理状态）", async () => {
		globalThis.fetch = vi.fn(async () => new Response("err", { status: 500 }));
		const res = await fetchWithRetry("https://x/", {}, { retries: 1, backoffMs: 1 });
		expect(res.status).toBe(500);
	});

	it("网络错误重试耗尽后抛出", async () => {
		globalThis.fetch = vi.fn(async () => {
			throw new Error("network down");
		});
		await expect(
			fetchWithRetry("https://x/", {}, { retries: 1, backoffMs: 1 }),
		).rejects.toThrow("network down");
	});

	it("4xx 不重试直接返回", async () => {
		globalThis.fetch = vi.fn(async () => new Response("nf", { status: 404 }));
		await fetchWithRetry("https://x/", {}, { retries: 2, backoffMs: 1 });
		expect(globalThis.fetch).toHaveBeenCalledTimes(1);
	});
});

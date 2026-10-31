import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
	version: "s.0",
	items: [] as unknown[],
	calls: 0,
}));

vi.mock("../src/lib/api", () => ({ cfEnv: {} }));
vi.mock("@server/settings/service", () => ({
	getSettingsVersionCached: async () => h.version,
}));
vi.mock("@server/posts/sanitize", () => ({
	redactPostSecrets: (x: unknown) => x,
}));
vi.mock("@server/posts/service", () => ({
	listPosts: async () => {
		h.calls++;
		return { posts: h.items, total: h.items.length, page: 1, pageSize: 200 };
	},
}));

import { fetchPostsForStats } from "../src/utils/content-utils";

const ITEM = {
	slug: "a",
	title: "A",
	date: "2026-01-02T00:00:00.000Z",
	description: "d",
	path: "/posts/a/",
};

describe("fetchPostsForStats SSR 缓存（P5）", () => {
	beforeEach(() => {
		h.items = [ITEM];
	});

	it("同版本二次调用命中缓存（不再打 D1）", async () => {
		h.version = "st.v1";
		h.calls = 0;
		const a = await fetchPostsForStats();
		expect(h.calls).toBe(1);
		expect(a[0].id).toBe("a");
		const b = await fetchPostsForStats();
		expect(h.calls).toBe(1); // 命中缓存，未再查
		expect(b).toEqual(a);
	});

	it("版本变化 → 失效并重查", async () => {
		h.version = "st.v2";
		h.calls = 0;
		await fetchPostsForStats();
		h.version = "st.v3";
		await fetchPostsForStats();
		expect(h.calls).toBe(2);
	});
});

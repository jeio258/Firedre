import { beforeEach, describe, expect, it, vi } from "vitest";
import { getRelatedPosts } from "../src/utils/content-utils";
import { apiPostToPostForList } from "../src/utils/post-types";

// getRelatedPosts 走 SSR 直取路径 → mock 掉 listPosts/cfEnv/脱敏，只测相关文章算法本身
const h = vi.hoisted(() => ({ items: [] as unknown[] }));
vi.mock("../src/lib/api", () => ({ cfEnv: {} }));
vi.mock("@server/posts/service", () => ({
	listPosts: async () => ({
		posts: h.items,
		total: h.items.length,
		page: 1,
		pageSize: 200,
	}),
}));
vi.mock("@server/posts/sanitize", () => ({
	redactPostSecrets: (x: unknown) => x,
}));

type ItemOpts = { tags?: string[]; category?: string; password?: string };
function item(slug: string, title: string, opts: ItemOpts = {}) {
	return {
		slug,
		title,
		date: "2026-01-01",
		path: `/posts/${slug}/`,
		tags: opts.tags ?? [],
		password: opts.password,
		frontmatter: opts.category ? { category: opts.category } : {},
	};
}

const asPost = (slug: string, title: string, opts: ItemOpts = {}) =>
	apiPostToPostForList(item(slug, title, opts));

beforeEach(() => {
	h.items = [];
});

describe("getRelatedPosts", () => {
	it("排除自身；标签命中优先于仅标题相似", async () => {
		h.items = [
			item("cur", "Alpha Beta", { tags: ["x"], category: "C" }),
			item("t1", "Alpha Beta Gamma", { tags: ["x"], category: "C" }),
			item("t2", "Alpha Beta", { tags: ["y"], category: "C" }),
			item("t3", "Other", { tags: [], category: "D" }),
		];
		const current = asPost("cur", "Alpha Beta", { tags: ["x"], category: "C" });
		const res = await getRelatedPosts(current, 2);
		expect(res.map((r) => r.id)).toEqual(["t1", "t2"]);
		expect(res.some((r) => r.id === "cur")).toBe(false);
	});

	it("排除受密码保护的文章", async () => {
		h.items = [
			item("cur", "T", { tags: ["x"] }),
			item("secret", "T", { tags: ["x"], password: "p" }),
			item("ok", "T", { tags: ["x"] }),
		];
		const current = asPost("cur", "T", { tags: ["x"] });
		const res = await getRelatedPosts(current, 5);
		expect(res.map((r) => r.id)).toEqual(["ok"]);
	});

	it("同一标题跨调用只分词一次（单例 + 标题缓存生效）", async () => {
		const uniq = `U${Date.now()}${Math.random().toString(36).slice(2)}`;
		const curTitle = `${uniq} 当前标题`;
		h.items = [
			item("cur", curTitle, { tags: ["x"] }),
			item("a", `${uniq} 候选一`, { tags: ["x"] }),
			item("b", `${uniq} 候选二`, { tags: ["y"] }),
		];
		const current = asPost("cur", curTitle, { tags: ["x"] });

		const spy = vi.spyOn(Intl.Segmenter.prototype, "segment");
		try {
			await getRelatedPosts(current, 5);
			const first = spy.mock.calls.length;
			spy.mockClear();
			await getRelatedPosts(current, 5);
			const second = spy.mock.calls.length;
			expect(first).toBeGreaterThan(0); // 首访：当前 + 两候选 = 3 次分词
			expect(second).toBe(0); // 再次：全部命中标题缓存
		} finally {
			spy.mockRestore();
		}
	});
});

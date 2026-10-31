import { describe, expect, it, vi } from "vitest";
import { searchPosts } from "../server/posts/service";

// 双通道（FTS trigram + LIKE 兜底）后，mock 记录全部 bind 首参按序断言：
// [0] 是 FTS MATCH 短语，FTS 空结果时 [1] 是 LIKE 兜底模式
function makeDbMock(capture: { queries: string[] }) {
	return {
		prepare(sql: string) {
			return {
				bind: (...args: unknown[]) => {
					capture.queries.push(args[0] as string);
					return {
						all: async () => ({ results: [] }),
					};
				},
			};
		},
	};
}

describe("searchPosts 关键词 FTS 转义（P2-3）", () => {
	it("普通多词关键词转义为带引号的 AND 短语", async () => {
		const capture: { queries: string[] } = { queries: [] };
		const env = { DB: makeDbMock(capture) } as never;
		await searchPosts(env, "hello world");
		expect(capture.queries[0]).toBe('"hello" AND "world"');
	});

	it("双引号在关键词内被转义（防 FTS 语法注入）", async () => {
		const capture: { queries: string[] } = { queries: [] };
		const env = { DB: makeDbMock(capture) } as never;
		await searchPosts(env, 'say "hi"');
		// FTS5 中 "" 表示字面双引号，不会成为语法
		expect(capture.queries[0]).toBe('"say" AND """hi"""');
	});

	it("FTS 操作符字符被当作文本而非语法", async () => {
		const capture: { queries: string[] } = { queries: [] };
		const env = { DB: makeDbMock(capture) } as never;
		await searchPosts(env, "NEAR(apple, banana)");
		expect(capture.queries[0]).toContain('"NEAR(apple,"');
	});

	it("≥3 字 FTS 未命中时回退 LIKE 子串查询", async () => {
		const capture: { queries: string[] } = { queries: [] };
		const env = { DB: makeDbMock(capture) } as never;
		await searchPosts(env, "hello world");
		// 第一次是 FTS 短语，回退后第二次是 LIKE 模式
		expect(capture.queries[1]).toBe("%hello world%");
	});

	it("<3 字关键词直接走 LIKE 不查 FTS", async () => {
		const capture: { queries: string[] } = { queries: [] };
		const env = { DB: makeDbMock(capture) } as never;
		await searchPosts(env, "湿巾");
		expect(capture.queries).toHaveLength(1);
		expect(capture.queries[0]).toBe("%湿巾%");
	});

	it("空关键词不发起查询", async () => {
		const env = { DB: { prepare: vi.fn() } } as never;
		const result = await searchPosts(env, "   ");
		expect(result).toEqual([]);
		expect(
			(env.DB as { prepare: ReturnType<typeof vi.fn> }).prepare,
		).not.toHaveBeenCalled();
	});
});

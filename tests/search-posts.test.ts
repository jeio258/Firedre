import { describe, it, expect, vi } from "vitest";
import { searchPosts } from "../server/posts/service";

function makeDbMock(capture: { query?: string }) {
	return {
		prepare(sql: string) {
			return {
				bind: (...args: unknown[]) => {
					// 记录传给 MATCH 的查询表达式
					capture.query = args[0] as string;
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
		const capture: { query?: string } = {};
		const env = { DB: makeDbMock(capture) } as never;
		await searchPosts(env, "hello world");
		expect(capture.query).toBe('"hello" AND "world"');
	});

	it("双引号在关键词内被转义（防 FTS 语法注入）", async () => {
		const capture: { query?: string } = {};
		const env = { DB: makeDbMock(capture) } as never;
		await searchPosts(env, 'say "hi"');
		// FTS5 中 "" 表示字面双引号，不会成为语法
		expect(capture.query).toBe('"say" AND """hi"""');
	});

	it("FTS 操作符字符被当作文本而非语法", async () => {
		const capture: { query?: string } = {};
		const env = { DB: makeDbMock(capture) } as never;
		await searchPosts(env, "NEAR(apple, banana)");
		expect(capture.query).toContain('"NEAR(apple,"');
	});

	it("空关键词不发起查询", async () => {
		const env = { DB: { prepare: vi.fn() } } as never;
		const result = await searchPosts(env, "   ");
		expect(result).toEqual([]);
		expect((env.DB as { prepare: ReturnType<typeof vi.fn> }).prepare).not.toHaveBeenCalled();
	});
});

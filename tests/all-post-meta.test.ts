import { describe, expect, it } from "vitest";
import { getAllPostMeta } from "../server/posts/allPostMeta";
import type { CloudflareEnv } from "../types/env";

function makeEnv(rows: unknown[]) {
	let calls = 0;
	const env = {
		DB: {
			prepare() {
				calls++;
				return { all: async () => ({ results: rows }) };
			},
		},
	} as unknown as CloudflareEnv;
	return { env, calls: () => calls };
}

const ROW = {
	slug: "hello",
	title: "Hello",
	description: "d",
	date: "2026-01-02T03:04:05.000Z",
	categories: '["tech","x"]',
	password: "",
};

describe("getAllPostMeta 版本化缓存（⑤b：layout 与 /api/allPostMeta.json 共用）", () => {
	it("首次查 D1 并映射字段", async () => {
		const { env, calls } = makeEnv([ROW]);
		const data = await getAllPostMeta(env, "t.vA");
		expect(calls()).toBe(1);
		expect(data).toEqual([
			{
				id: "hello",
				title: "Hello",
				description: "d",
				published: new Date("2026-01-02T03:04:05.000Z").getTime(),
				category: "tech",
				password: false,
			},
		]);
	});

	it("同版本二次调用命中缓存，不再查 D1", async () => {
		const { env, calls } = makeEnv([ROW]);
		await getAllPostMeta(env, "t.vB");
		await getAllPostMeta(env, "t.vB");
		expect(calls()).toBe(1);
	});

	it("版本变化 → 失效并重查 D1", async () => {
		const { env, calls } = makeEnv([ROW]);
		await getAllPostMeta(env, "t.vC");
		await getAllPostMeta(env, "t.vD");
		expect(calls()).toBe(2);
	});
});

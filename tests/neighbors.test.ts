import { DatabaseSync } from "node:sqlite";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getPostNeighbors, upsertPost } from "../server/posts/service";
import { makeD1 } from "./helpers/d1";
import { applyMigrations } from "./helpers/migrations";
import { makeR2 } from "./helpers/r2";

let db: DatabaseSync;
let env: { DB: unknown; BUCKET: ReturnType<typeof makeR2> };

beforeAll(() => {
	db = new DatabaseSync(":memory:");
	applyMigrations(db);
});

beforeEach(() => {
	db.exec(
		"DELETE FROM posts; DELETE FROM posts_fts; DELETE FROM post_taxonomy;",
	);
	env = { DB: makeD1(db), BUCKET: makeR2() };
});

const source = (title: string, date: string, pin = 0) =>
	`---\ntitle: ${title}\ndate: ${date}\npublished: true\n${pin ? `pin_order: ${pin}\n` : ""}---\n\n正文 ${title}`;

describe("getPostNeighbors 窗口函数前后篇", () => {
	it("按日期倒序返回相邻文章", async () => {
		await upsertPost(env as never, "a", source("A", "2026-01-03"));
		await upsertPost(env as never, "b", source("B", "2026-01-02"));
		await upsertPost(env as never, "c", source("C", "2026-01-01"));

		const mid = await getPostNeighbors(env as never, "b");
		expect(mid.prev?.slug).toBe("a"); // 前一篇 = 更新的 a
		expect(mid.next?.slug).toBe("c"); // 后一篇 = 更旧的 c

		const first = await getPostNeighbors(env as never, "a");
		expect(first.prev).toBeNull();
		expect(first.next?.slug).toBe("b");

		const last = await getPostNeighbors(env as never, "c");
		expect(last.prev?.slug).toBe("b");
		expect(last.next).toBeNull();
	});

	it("置顶文章排在最前参与排序", async () => {
		await upsertPost(env as never, "a", source("A", "2026-01-03"));
		await upsertPost(env as never, "b", source("B", "2026-01-02", 1));
		await upsertPost(env as never, "c", source("C", "2026-01-01"));

		const neighbors = await getPostNeighbors(env as never, "a");
		// 排序：b(置顶) → a → c；a 的前一篇是 b
		expect(neighbors.prev?.slug).toBe("b");
		expect(neighbors.next?.slug).toBe("c");
	});

	it("不存在或未发布的文章返回空", async () => {
		await upsertPost(env as never, "a", source("A", "2026-01-03"));
		const missing = await getPostNeighbors(env as never, "nope");
		expect(missing).toEqual({ prev: null, next: null });
	});

	it("⑤c：前后篇合并为单条 D1 查询", async () => {
		await upsertPost(env as never, "a", source("A", "2026-01-03"));
		await upsertPost(env as never, "b", source("B", "2026-01-02"));
		await upsertPost(env as never, "c", source("C", "2026-01-01"));
		const inner = makeD1(db) as { prepare: (...a: unknown[]) => unknown };
		let calls = 0;
		const counting = {
			prepare: (...args: unknown[]) => {
				calls++;
				return inner.prepare(...args);
			},
		};
		const n = await getPostNeighbors({ DB: counting } as never, "b");
		expect(n.prev?.slug).toBe("a");
		expect(n.next?.slug).toBe("c");
		expect(calls).toBe(1);
	});
});

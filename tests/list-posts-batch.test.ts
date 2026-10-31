import { DatabaseSync } from "node:sqlite";
import { beforeAll, describe, expect, it } from "vitest";
import { listDynamics } from "../server/dynamic/service";
import { listPosts } from "../server/posts/service";
import { type D1Like, makeD1 } from "./helpers/d1";
import { applyMigrations } from "./helpers/migrations";

// 在基础 D1 桩上补 batch()：模拟真实 D1 的「多条语句单次往返」，
// 每条的 results 由对应 all() 产出（本用例只涉及只读 COUNT/SELECT）。
function withBatch(base: D1Like): D1Like {
	const db = {
		prepare: base.prepare,
		async batch(stmts: Array<{ all(): Promise<{ results: unknown[] }> }>) {
			const out: Array<{ results: unknown[]; success: boolean }> = [];
			for (const s of stmts)
				out.push({ results: (await s.all()).results, success: true });
			return out;
		},
	};
	return db as D1Like;
}

describe("listPosts / listDynamics：COUNT+SELECT 合并（batch）与串行结果一致", () => {
	let db: DatabaseSync;

	beforeAll(() => {
		db = new DatabaseSync(":memory:");
		applyMigrations(db);
		// 2 已发布 + 1 未发布；pin_order 制造排序差异
		db.prepare(
			"INSERT INTO posts (slug,title,date,r2_key,published,pin_order) VALUES ('a','A','2026-01-01','r2/a',1,0)",
		).run();
		db.prepare(
			"INSERT INTO posts (slug,title,date,r2_key,published,pin_order) VALUES ('b','B','2026-02-01','r2/b',1,5)",
		).run();
		db.prepare(
			"INSERT INTO posts (slug,title,date,r2_key,published,pin_order) VALUES ('c','C','2026-03-01','r2/c',0,0)",
		).run();
		db.prepare(
			"INSERT INTO dynamics (id,content,published,pinned) VALUES ('d1','x',1,0)",
		).run();
		db.prepare(
			"INSERT INTO dynamics (id,content,published,pinned) VALUES ('d2','y',2,1)",
		).run();
	});

	it("listPosts：batch 与串行返回完全一致（默认只统计已发布）", async () => {
		const serial = await listPosts({ DB: makeD1(db) } as never, {
			page: 1,
			pageSize: 10,
		});
		const batched = await listPosts({ DB: withBatch(makeD1(db)) } as never, {
			page: 1,
			pageSize: 10,
		});
		expect(batched).toEqual(serial);
		expect(serial.total).toBe(2);
		expect(serial.posts.map((p) => p.slug)).toEqual(["b", "a"]); // pin_order 降序在前
	});

	it("listPosts：越界页 total 仍正确（batch 分支不丢 total）", async () => {
		const batched = await listPosts({ DB: withBatch(makeD1(db)) } as never, {
			page: 9,
			pageSize: 10,
		});
		expect(batched.total).toBe(2);
		expect(batched.posts).toEqual([]);
	});

	it("listDynamics：batch 与串行一致", async () => {
		const serial = await listDynamics({ DB: makeD1(db) } as never, {
			page: 1,
			pageSize: 10,
		});
		const batched = await listDynamics({ DB: withBatch(makeD1(db)) } as never, {
			page: 1,
			pageSize: 10,
		});
		expect(batched.total).toBe(2);
		expect(batched.items.map((i) => i.id)).toEqual(
			serial.items.map((i) => i.id),
		);
	});
});

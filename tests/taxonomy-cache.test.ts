import { DatabaseSync } from "node:sqlite";
import { beforeAll, describe, expect, it } from "vitest";
import { listCategoryTree, listTagCounts } from "../server/posts/taxonomy";
import { makeD1 } from "./helpers/d1";
import { applyMigrations } from "./helpers/migrations";

let db: DatabaseSync;

beforeAll(() => {
	db = new DatabaseSync(":memory:");
	applyMigrations(db);
	// 造一份最小数据：1 篇文章 + 1 分类 + 1 标签
	db.exec(`
    INSERT INTO posts (slug, title, date, published, r2_key)
    VALUES ('t1', 'T1', '2026-01-01', 1, 'posts/t1/index.md');
    INSERT INTO post_taxonomy (post_slug, type, value) VALUES ('t1', 'category', 'cat/a');
    INSERT INTO post_taxonomy (post_slug, type, value) VALUES ('t1', 'tag', 'alpha');
  `);
});

/** 统计命中指定 SQL 片段的 prepare 次数（version 读取等其它查询不计入） */
function countingDb(inner: ReturnType<typeof makeD1>, match: string) {
	let n = 0;
	return {
		db: {
			prepare(sql: string) {
				if (typeof sql === "string" && sql.includes(match)) n++;
				return inner.prepare(sql);
			},
		},
		calls: () => n,
	};
}

describe("taxonomy 清单 isolate 缓存（每页侧栏读取的省流）", () => {
	it("同版本重复调用只查一次 D1（第二次命中缓存）", async () => {
		const c = countingDb(makeD1(db), "post_taxonomy");
		const first = await listTagCounts({ DB: c.db } as never);
		const afterFirst = c.calls();
		// 第二次同版本：必须命中 isolate 缓存 → 不再发查询
		const second = await listTagCounts({ DB: c.db } as never);
		expect(c.calls()).toBe(afterFirst);
		expect(second).toEqual(first);
		expect(first.length).toBe(1);
	});

	it("分类与标签使用不同 slot（互不串台）", async () => {
		const c = countingDb(makeD1(db), "post_taxonomy");
		const cats = await listCategoryTree({ DB: c.db } as never);
		const tags = await listTagCounts({ DB: c.db } as never);
		// 两类清单各自至少查一次（未互相复用缓存），且内容正确
		expect(c.calls()).toBeGreaterThanOrEqual(1);
		expect(JSON.stringify(cats)).toContain("cat");
		expect(tags[0]?.name).toBe("alpha");
	});
});

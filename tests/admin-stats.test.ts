import { DatabaseSync } from "node:sqlite";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { collectAdminStats } from "../server/admin/stats";
import { makeD1 } from "./helpers/d1";
import { applyMigrations } from "./helpers/migrations";

let db: DatabaseSync;
const stats = () => collectAdminStats(makeD1(db) as never);

beforeAll(() => {
	db = new DatabaseSync(":memory:");
	applyMigrations(db);
});

beforeEach(() => {
	db.exec(
		"DELETE FROM posts; DELETE FROM post_taxonomy; DELETE FROM dynamics; DELETE FROM friends; DELETE FROM albums; DELETE FROM site_settings;",
	);
});

interface PostOpts {
	title?: string;
	published?: number;
	date?: string;
	updated?: string | null;
	words?: number;
	minutes?: number;
	categories?: string | null;
	tags?: string | null;
	pinOrder?: number;
}

function addPost(slug: string, opts: PostOpts = {}): void {
	db.prepare(
		"INSERT INTO posts (slug, title, date, updated, categories, tags, published, words, minutes, r2_key, pin_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?)",
	).run(
		slug,
		opts.title ?? slug,
		opts.date ?? "2026-01-15T00:00:00.000Z",
		opts.updated ?? null,
		opts.categories ?? null,
		opts.tags ?? null,
		opts.published ?? 1,
		opts.words ?? 0,
		opts.minutes ?? 0,
		opts.pinOrder ?? 0,
	);
}

describe("collectAdminStats 聚合（R4 抽取后真 SQL 验证）", () => {
	it("totals：按 published 区分发布/草稿，words 仅计已发布", async () => {
		addPost("a", { published: 1, words: 120 });
		addPost("b", { published: 1, words: 80 });
		addPost("c", { published: 0, words: 999 });

		const s = await stats();
		expect(s.totals.posts).toBe(3);
		expect(s.totals.published).toBe(2);
		expect(s.totals.draft).toBe(1);
		// topRows 仅取 published=1，故草稿 words 不计入
		expect(s.totals.words).toBe(200);
		expect(s.statusDist).toEqual([
			{ name: "已发布", value: 2 },
			{ name: "草稿", value: 1 },
		]);
	});

	it("categoryDist：只计已发布、按父级路径归并、降序", async () => {
		addPost("a", { published: 1 });
		addPost("b", { published: 1 });
		addPost("c", { published: 1 });
		addPost("d", { published: 0 }); // 草稿不应计入
		const cat = (slug: string, value: string) =>
			db
				.prepare(
					"INSERT INTO post_taxonomy (post_slug, type, value) VALUES (?, 'category', ?)",
				)
				.run(slug, value);
		cat("a", "tech/sub");
		cat("b", "tech/other");
		cat("c", "life");
		cat("d", "draft-only");

		const s = await stats();
		expect(s.categoryDist).toEqual([
			{ name: "tech", 文章数: 2 },
			{ name: "life", 文章数: 1 },
		]);
		expect(s.totals.categories).toBe(2);
	});

	it("recent：published 转布尔、pinned 由 pin_order>0、updated 缺省回退 date、分类/标签解析", async () => {
		addPost("a", {
			published: 1,
			pinOrder: 5,
			updated: null,
			date: "2026-02-01T00:00:00.000Z",
			categories: '["tech","x"]',
			tags: '["t1"]',
		});

		const s = await stats();
		expect(s.recent[0]).toEqual({
			slug: "a",
			title: "a",
			categories: ["tech", "x"],
			tags: ["t1"],
			published: true,
			pinned: true,
			updated: "2026-02-01T00:00:00.000Z",
		});
	});

	it("monthlyTrend：恒为 12 桶；近月发布/草稿计入对应时段", async () => {
		const now = Date.now();
		addPost("p", {
			published: 1,
			date: new Date(now - 5 * 86400_000).toISOString(),
		});
		addPost("d", {
			published: 0,
			date: new Date(now - 3 * 86400_000).toISOString(),
		});

		const s = await stats();
		expect(s.monthlyTrend).toHaveLength(12);
		const 发布 = s.monthlyTrend.reduce((acc, m) => acc + m.发布, 0);
		const 草稿 = s.monthlyTrend.reduce((acc, m) => acc + m.草稿, 0);
		expect(发布).toBe(1);
		expect(草稿).toBe(1);
	});

	it("siteTitle：读 site_settings.basic JSON；缺失/损坏时回落默认", async () => {
		const s0 = await stats();
		expect(s0.siteTitle).toBe("Firedre");

		db.prepare(
			"INSERT INTO site_settings (key, value) VALUES ('basic', ?)",
		).run(JSON.stringify({ title: "My Blog" }));
		const s1 = await stats();
		expect(s1.siteTitle).toBe("My Blog");
	});

	it("社交计数：dynamics / friends(含 enabled 求和) / albums / tags", async () => {
		db.prepare(
			"INSERT INTO dynamics (id, content, published) VALUES ('d1', 'x', 1)",
		).run();
		db.prepare(
			"INSERT INTO friends (title, imgurl, siteurl, enabled) VALUES ('f1','u','s',1)",
		).run();
		db.prepare(
			"INSERT INTO friends (title, imgurl, siteurl, enabled) VALUES ('f2','u','s',0)",
		).run();
		db.prepare("INSERT INTO albums (slug, title) VALUES ('al1','Album')").run();
		addPost("x", { published: 1 });
		db.prepare(
			"INSERT INTO post_taxonomy (post_slug, type, value) VALUES ('x','tag','t')",
		).run();

		const s = await stats();
		expect(s.totals.dynamics).toBe(1);
		expect(s.totals.friends).toBe(2);
		expect(s.totals.friendsEnabled).toBe(1);
		expect(s.totals.albums).toBe(1);
		expect(s.totals.tags).toBe(1);
	});
});

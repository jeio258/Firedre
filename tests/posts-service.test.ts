import { DatabaseSync } from "node:sqlite";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
	buildListPostsQuery,
	deletePost,
	getPostBySlug,
	listPosts,
	searchPosts,
	upsertPost,
} from "../server/posts/service";
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

const source = (title: string) =>
	`---\ntitle: ${title}\ndate: 2026-01-01\npublished: true\ncategories:\n  - Tech/前端\ntags: [a, b]\n---\n\n# Hello\n\n正文内容 world\n`;

describe("upsertPost 写入与回读", () => {
	it("写入 D1/R2 并可按 slug 回读详情", async () => {
		const r = await upsertPost(
			env as never,
			"hello-world",
			source("Hello World"),
		);
		expect(r.slug).toBe("hello-world");
		expect(r.r2Key).toMatch(/^posts\/hello-world\/[0-9a-f]{64}\.md$/);
		expect(env.BUCKET.store.get(r.r2Key)).toContain("Hello World");

		const detail = await getPostBySlug(env as never, "hello-world", {
			includeUnpublished: true,
		});
		expect(detail).not.toBeNull();
		expect(detail!.slug).toBe("hello-world");
		expect(detail!.title).toBe("Hello World");
		expect(detail!.html).toContain("Hello");
		expect(detail!.frontmatter.tags).toEqual(["a", "b"]);
	});

	it("重复 upsert 覆盖同 slug 且不产生重复行", async () => {
		await upsertPost(env as never, "hello-world", source("V1"));
		await upsertPost(env as never, "hello-world", source("V2"));
		const count = db.prepare("SELECT COUNT(*) AS c FROM posts").get() as {
			c: number;
		};
		expect(count.c).toBe(1);
		const detail = await getPostBySlug(env as never, "hello-world", {
			includeUnpublished: true,
		});
		expect(detail!.title).toBe("V2");
	});

	it("taxonomy 同步：分类与标签写入统一表", async () => {
		await upsertPost(env as never, "hello-world", source("T"));
		const rows = db
			.prepare(
				"SELECT type, value FROM post_taxonomy WHERE post_slug = 'hello-world' ORDER BY type",
			)
			.all() as Array<{ type: string; value: string }>;
		const cats = rows.filter((x) => x.type === "category").map((x) => x.value);
		const tags = rows.filter((x) => x.type === "tag").map((x) => x.value);
		expect(cats).toContain("Tech/前端");
		expect(tags).toEqual(expect.arrayContaining(["a", "b"]));
	});

	it("缺少 title/published 时拒绝保存", async () => {
		await expect(
			upsertPost(env as never, "bad", "---\nfoo: bar\n---\n\nx"),
		).rejects.toThrow();
	});
});

describe("listPosts / searchPosts / deletePost", () => {
	it("listPosts 分页与已发布过滤", async () => {
		await upsertPost(env as never, "p1", source("P1"));
		await upsertPost(env as never, "p2", source("P2"));
		const all = await listPosts(env as never, { includeUnpublished: true });
		expect(all.posts).toHaveLength(2);
		const page1 = await listPosts(env as never, {
			includeUnpublished: true,
			page: 1,
			pageSize: 1,
		});
		expect(page1.posts).toHaveLength(1);
	});

	it("searchPosts 通过 FTS 命中关键词", async () => {
		await upsertPost(env as never, "hello-world", source("Hello"));
		const hits = await searchPosts(env as never, "world", 20);
		expect(hits.some((p) => p.slug === "hello-world")).toBe(true);
	});

	it("deletePost 删除文章、FTS 与 taxonomy", async () => {
		await upsertPost(env as never, "hello-world", source("Hello"));
		expect(await deletePost(env as never, "hello-world")).toBe(true);
		expect(
			await getPostBySlug(env as never, "hello-world", {
				includeUnpublished: true,
			}),
		).toBeNull();
		const fts = db
			.prepare("SELECT COUNT(*) AS c FROM posts_fts WHERE slug = 'hello-world'")
			.get() as { c: number };
		const tax = db
			.prepare(
				"SELECT COUNT(*) AS c FROM post_taxonomy WHERE post_slug = 'hello-world'",
			)
			.get() as { c: number };
		expect(fts.c).toBe(0);
		expect(tax.c).toBe(0);
		expect(await deletePost(env as never, "hello-world")).toBe(false);
	});
});

describe("listPosts 查询计划与去重（P1-P3）", () => {
	const planText = (opts: Parameters<typeof buildListPostsQuery>[0]) => {
		const { listSql, binds } = buildListPostsQuery(opts);
		const rows = db
			.prepare(`EXPLAIN QUERY PLAN ${listSql}`)
			.all(...binds, 10, 0) as Array<{ detail: string }>;
		return rows.map((r) => r.detail).join("\n");
	};

	it("各过滤组合的查询计划均无 DISTINCT 临时表", () => {
		for (const opts of [
			{},
			{ tag: "a" },
			{ category: "Tech" },
			{ month: "2026-01" },
			{ tag: "a", category: "Tech" },
		]) {
			expect(planText(opts)).not.toContain("DISTINCT");
		}
	});

	it("tag 过滤：多标签文章每篇只出现一次，total 与条数一致", async () => {
		await upsertPost(env as never, "p1", source("P1")); // tags [a, b]
		await upsertPost(env as never, "p2", source("P2"));
		const r = await listPosts(env as never, {
			tag: "a",
			includeUnpublished: true,
		});
		expect(r.posts.map((p) => p.slug).sort()).toEqual(["p1", "p2"]);
		expect(r.total).toBe(2);
	});

	it("category 过滤（含子分类 LIKE）：每篇一次且 total 一致", async () => {
		await upsertPost(env as never, "p1", source("P1")); // category Tech/前端
		await upsertPost(env as never, "p2", source("P2"));
		const r = await listPosts(env as never, {
			category: "Tech",
			includeUnpublished: true,
		});
		expect(r.posts.map((p) => p.slug).sort()).toEqual(["p1", "p2"]);
		expect(r.total).toBe(2);
	});
});

describe("版本化正文 key（E-01）", () => {
	const vKeys = () =>
		[...env.BUCKET.store.keys()].filter((k) =>
			k.startsWith("posts/hello-world/"),
		);
	const rowOf = () =>
		db
			.prepare("SELECT r2_key, title FROM posts WHERE slug = 'hello-world'")
			.get() as { r2_key: string; title: string };

	it("内容变更产生新 key，旧 key 被回收，D1 指针指向最新", async () => {
		const v1 = await upsertPost(env as never, "hello-world", source("V1"));
		const v2 = await upsertPost(env as never, "hello-world", source("V2"));
		expect(v2.r2Key).not.toBe(v1.r2Key);
		expect(env.BUCKET.store.has(v1.r2Key)).toBe(false);
		expect(env.BUCKET.store.get(v2.r2Key)).toContain("V2");
		expect(vKeys()).toHaveLength(1);
		expect(rowOf().r2_key).toBe(v2.r2Key);
	});

	it("内容不变复用既有对象（同 hash 同 key，零重复写）", async () => {
		await upsertPost(env as never, "hello-world", source("Same"));
		const r2 = await upsertPost(env as never, "hello-world", source("Same"));
		expect(vKeys()).toHaveLength(1);
		expect(rowOf().r2_key).toBe(r2.r2Key);
	});

	it("R2 写失败时 D1 指针与元数据保持旧版（无 torn write）", async () => {
		await upsertPost(env as never, "hello-world", source("V1"));
		const failing = {
			...env.BUCKET,
			put: async (key: string, body: string) => {
				throw new Error("r2 故障");
			},
		};
		await expect(
			upsertPost(
				{ DB: env.DB, BUCKET: failing } as never,
				"hello-world",
				source("V2"),
			),
		).rejects.toThrow("r2 故障");
		expect(rowOf().title).toBe("V1");
		expect(vKeys()).toHaveLength(1);
		expect(rowOf().r2_key).toBe(vKeys()[0]);
	});
});

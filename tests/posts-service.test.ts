import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { DatabaseSync } from "node:sqlite";
import {
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
		const r = await upsertPost(env as never, "hello-world", source("Hello World"));
		expect(r.slug).toBe("hello-world");
		expect(env.BUCKET.store.get("posts/hello-world.md")).toContain("Hello World");

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
		expect(await getPostBySlug(env as never, "hello-world", { includeUnpublished: true })).toBeNull();
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

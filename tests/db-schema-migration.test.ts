import { describe, it, expect, beforeAll } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
	syncPostTaxonomy,
	listCategoryTree,
	listTagCounts,
	categoryFilterSql,
	tagFilterSql,
} from "../server/posts/taxonomy";
import type { PostFrontmatter } from "../types/posts";

/**
 * D1 迁移集成测试：按序应用 migrations/*.sql 到内存 SQLite，验证最终 schema
 * 的读写与查询路径端到端可用。
 *
 * 背景：分类/标签统一为单表 post_taxonomy(post_slug, type, value)，
 * 通用限流与登录防暴统一为 rate_limits(key, kind, ...)。本测试守卫
 * 干净 schema 不回归——旧表（post_categories/post_tags/api_rate_limits/admin_login_attempts）
 * 必须不存在，新表必须可用。
 */

interface D1Like {
	prepare(sql: string): D1StmtLike;
}

interface D1StmtLike {
	bind(...args: unknown[]): D1StmtLike;
	run(): Promise<unknown>;
	first<T = Record<string, unknown>>(): Promise<T | null>;
	all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
}

function makeD1(db: DatabaseSync): D1Like {
	return {
		prepare(sql: string) {
			let args: unknown[] = [];
			const stmt = db.prepare(sql);
			const bind = (...more: unknown[]) => {
				args = [...args, ...more];
				return chain;
			};
			const chain: D1StmtLike = {
				bind,
				run: async () => {
					(stmt as unknown as { run(...a: unknown[]): unknown }).run(...args);
					return {};
				},
				first: async <T>() =>
					((stmt as unknown as { get(...a: unknown[]): unknown }).get(
						...args,
					) as T | undefined) ?? null,
				all: async <T>() => {
					const rows = (stmt as unknown as { all(...a: unknown[]): unknown[] }).all(
						...args,
					) as T[];
					return { results: rows };
				},
			};
			return chain;
		},
	};
}

describe("D1 迁移：post_taxonomy 表统一（post_categories + post_tags 合并）", () => {
	let db: DatabaseSync;

	beforeAll(() => {
		db = new DatabaseSync(":memory:");
		const migDir = join(process.cwd(), "migrations");
		const files = readdirSync(migDir)
			.filter((f) => f.endsWith(".sql"))
			.sort();
		for (const file of files) {
			db.exec(readFileSync(join(migDir, file), "utf8"));
		}
		// 造两篇已发布文章（posts 表有多个 NOT NULL 列需齐全）
		db.prepare(
			"INSERT INTO posts (slug, title, date, r2_key, published) VALUES ('a','A','2026-01-01','r2/a',1)",
		).run();
		db.prepare(
			"INSERT INTO posts (slug, title, date, r2_key, published) VALUES ('b','B','2026-02-01','r2/b',1)",
		).run();
	});

	const env = () => ({ DB: makeD1(db) });

	it("迁移后旧表不存在、新表存在", () => {
		const tables = db
			.prepare(
				"SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
			)
			.all() as Array<{ name: string }>;
		const names = tables.map((t) => t.name);
		expect(names).toContain("post_taxonomy");
		expect(names).not.toContain("post_categories");
		expect(names).not.toContain("post_tags");
		expect(names).not.toContain("api_rate_limits");
		expect(names).not.toContain("admin_login_attempts");
		expect(names).toContain("rate_limits");
	});

	it("syncPostTaxonomy 写入统一表（分类+标签）", async () => {
		await syncPostTaxonomy(env() as never, "a", {
			categories: ["分类一"],
			tags: ["标签A", "标签B"],
		} as PostFrontmatter);
		await syncPostTaxonomy(env() as never, "b", {
			category: "分类二",
			tags: ["标签A"],
		} as PostFrontmatter);

		const rows = db
			.prepare("SELECT post_slug, type, value FROM post_taxonomy ORDER BY post_slug, type, value")
			.all() as Array<{ post_slug: string; type: string; value: string }>;
		expect(rows).toEqual([
			{ post_slug: "a", type: "category", value: "分类一" },
			{ post_slug: "a", type: "tag", value: "标签A" },
			{ post_slug: "a", type: "tag", value: "标签B" },
			{ post_slug: "b", type: "category", value: "分类二" },
			{ post_slug: "b", type: "tag", value: "标签A" },
		]);
	});

	it("listCategoryTree 按分类聚合（只统计已发布文章）", async () => {
		const tree = await listCategoryTree(env() as never);
		// buildCategoryTreeFromPaths 返回的序列化结构
		const flat = JSON.stringify(tree);
		expect(flat).toContain("分类一");
		expect(flat).toContain("分类二");
	});

	it("listTagCounts 聚合标签计数", async () => {
		const counts = await listTagCounts(env() as never);
		const a = counts.find((c) => c.name === "标签A");
		expect(a).toBeDefined();
		expect(a!.count).toBe(2); // 文章 a、b 都有
		const b = counts.find((c) => c.name === "标签B");
		expect(b).toBeDefined();
		expect(b!.count).toBe(1);
	});

	it("categoryFilterSql / tagFilterSql 生成可用的 JOIN 查询", () => {
		const cat = categoryFilterSql("分类一");
		const rows = db
			.prepare(
				`SELECT p.slug FROM posts p ${cat.join} WHERE ${cat.where} AND p.published=1`,
			)
			.all(...cat.binds) as Array<{ slug: string }>;
		expect(rows.map((r) => r.slug)).toContain("a");

		const tag = tagFilterSql("标签A");
		const tRows = db
			.prepare(
				`SELECT p.slug FROM posts p ${tag.join} WHERE ${tag.where} AND p.published=1`,
			)
			.all(...tag.binds) as Array<{ slug: string }>;
		expect(tRows.map((r) => r.slug).sort()).toEqual(["a", "b"]);
	});
});

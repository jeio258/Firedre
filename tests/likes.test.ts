import { DatabaseSync } from "node:sqlite";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getLikeState, toggleLike } from "../server/likes/service";
import { UserError } from "../server/utils/userError";
import { type D1Like, type D1StmtLike, makeD1 } from "./helpers/d1";
import { applyMigrations } from "./helpers/migrations";

let db: DatabaseSync;
let d1: D1Like;

const SLUG = "published-post";

beforeAll(() => {
	db = new DatabaseSync(":memory:");
	applyMigrations(db);
});

beforeEach(() => {
	db.exec("DELETE FROM post_likes; DELETE FROM posts; DELETE FROM users;");
	db.exec(
		`INSERT INTO posts (slug, title, date, published, r2_key) VALUES
		 ('${SLUG}', 'Published', '2026-01-01', 1, 'posts/published.md'),
		 ('draft-post', 'Draft', '2026-01-02', 0, 'posts/draft.md')`,
	);
	db.exec(
		`INSERT INTO users (id, email, name) VALUES
		 ('u1', 'u1@test.local', 'U1'),
		 ('u2', 'u2@test.local', 'U2')`,
	);
	d1 = makeD1(db);
});

/**
 * 把 DELETE 拦在同一道栅栏后：两个并发 toggle 都先删不到行，才会一起走到
 * INSERT ... ON CONFLICT DO NOTHING，能确定性复现并发插入同主键的场景。
 */
function makeBarrierD1(target: DatabaseSync, waiters = 2): D1Like {
	const base = makeD1(target);
	let arrived = 0;
	let release: () => void = () => {};
	const gate = new Promise<void>((resolve) => {
		release = resolve;
	});

	return {
		prepare(sql: string): D1StmtLike {
			if (!/^\s*DELETE/i.test(sql)) return base.prepare(sql);

			const stmt = base.prepare(sql);
			let args: unknown[] = [];
			const chain: D1StmtLike = {
				bind(...more: unknown[]) {
					args = [...args, ...more];
					return chain;
				},
				async run() {
					arrived += 1;
					if (arrived >= waiters) release();
					await gate;
					return stmt.bind(...args).run();
				},
				first: stmt.first,
				all: stmt.all,
			};
			return chain;
		},
	};
}

describe("getLikeState", () => {
	it("匿名只返回计数，liked 恒为 false", async () => {
		await toggleLike(d1 as never, SLUG, "u1");

		await expect(getLikeState(d1 as never, SLUG, null)).resolves.toEqual({
			count: 1,
			liked: false,
		});
	});

	it("登录用户区分自己是否点过", async () => {
		await toggleLike(d1 as never, SLUG, "u1");

		await expect(getLikeState(d1 as never, SLUG, "u1")).resolves.toEqual({
			count: 1,
			liked: true,
		});
		await expect(getLikeState(d1 as never, SLUG, "u2")).resolves.toEqual({
			count: 1,
			liked: false,
		});
	});

	it("未发布文章与不存在的文章一律拒绝", async () => {
		for (const slug of ["draft-post", "missing-post"]) {
			await expect(getLikeState(d1 as never, slug, null)).rejects.toThrow(
				UserError,
			);
			await expect(getLikeState(d1 as never, slug, "u1")).rejects.toThrow(
				"文章不存在",
			);
		}
	});

	it("slug 为空或超长拒绝", async () => {
		await expect(getLikeState(d1 as never, "  ", null)).rejects.toThrow(
			"文章标识不能为空",
		);
		await expect(
			getLikeState(d1 as never, "x".repeat(201), null),
		).rejects.toThrow("文章标识不合法");
	});
});

describe("toggleLike", () => {
	it("一次调用点赞，再次调用取消，计数与落库行同步", async () => {
		await expect(toggleLike(d1 as never, SLUG, "u1")).resolves.toEqual({
			count: 1,
			liked: true,
		});
		expect(rows()).toBe(1);

		await expect(toggleLike(d1 as never, SLUG, "u1")).resolves.toEqual({
			count: 0,
			liked: false,
		});
		expect(rows()).toBe(0);

		await expect(toggleLike(d1 as never, SLUG, "u1")).resolves.toEqual({
			count: 1,
			liked: true,
		});
		expect(rows()).toBe(1);
	});

	it("多用户计数互不干扰", async () => {
		await toggleLike(d1 as never, SLUG, "u1");
		await expect(toggleLike(d1 as never, SLUG, "u2")).resolves.toEqual({
			count: 2,
			liked: true,
		});

		await expect(toggleLike(d1 as never, SLUG, "u1")).resolves.toEqual({
			count: 1,
			liked: false,
		});
		expect(rows()).toBe(1);
	});

	it("同一用户并发点赞：ON CONFLICT 只留一行，双方都看到最终计数", async () => {
		const gated = makeBarrierD1(db);

		const [a, b] = await Promise.all([
			toggleLike(gated as never, SLUG, "u1"),
			toggleLike(gated as never, SLUG, "u1"),
		]);

		expect(a).toEqual({ count: 1, liked: true });
		expect(b).toEqual({ count: 1, liked: true });
		expect(rows()).toBe(1);
	});

	it("未发布文章与未登录拒绝写入", async () => {
		await expect(toggleLike(d1 as never, "draft-post", "u1")).rejects.toThrow(
			"文章不存在",
		);
		await expect(toggleLike(d1 as never, SLUG, "")).rejects.toThrow("请先登录");
		expect(rows()).toBe(0);
	});
});

function rows(): number {
	const row = db.prepare("SELECT COUNT(*) AS n FROM post_likes").get() as {
		n: number;
	};
	return Number(row.n);
}

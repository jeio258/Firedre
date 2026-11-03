import { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	getAdminCommentsOverview,
	listCommentsForAdmin,
	moderateComment,
	submitComment,
} from "../server/comments/service";
import { UserError } from "../server/utils/userError";
import { type D1Like, makeD1 } from "./helpers/d1";
import { applyMigrations } from "./helpers/migrations";

const h = vi.hoisted(() => ({
	admin: true,
	env: {} as Record<string, unknown>,
}));

vi.mock("../src/lib/api", async () => {
	const { UserError: ServiceError } = await import("../server/utils/userError");
	const json = (data: unknown, status = 200) =>
		new Response(JSON.stringify(data), {
			status,
			headers: { "Content-Type": "application/json; charset=utf-8" },
		});
	return {
		cfEnv: h.env,
		json,
		notFound: (message = "Not found") => json({ message }, 404),
		badRequest: (message: string) => json({ message }, 400),
		unauthorized: () => json({ message: "未授权" }, 401),
		methodNotAllowed: () => json({ message: "Method not allowed" }, 405),
		serverError: (e: unknown) =>
			json(
				{ message: e instanceof ServiceError ? e.message : "服务器错误" },
				500,
			),
		fromServiceError: (e: unknown) =>
			e instanceof ServiceError
				? json({ message: e.message }, 400)
				: json({ message: "服务器错误" }, 500),
	};
});

vi.mock("@server/auth/adminSession", () => ({
	verifyAdminRequest: async () => h.admin,
}));

const TARGET = "/posts/hello";

let db: DatabaseSync;
let d1: D1Database;

// 在基础 D1 桩上补 batch()，并记录往返次数：真实 D1 的 batch 是「多条语句一次往返」
function withBatch(base: D1Like) {
	const state = { calls: 0, statements: 0 };
	const dbLike = {
		prepare: base.prepare,
		async batch(stmts: Array<{ all(): Promise<{ results: unknown[] }> }>) {
			state.calls += 1;
			state.statements += stmts.length;
			const out: Array<{ results: unknown[]; success: boolean }> = [];
			for (const s of stmts)
				out.push({ results: (await s.all()).results, success: true });
			return out;
		},
	};
	return { db: dbLike as unknown as D1Database, state };
}

async function seed(): Promise<void> {
	db.prepare(
		"INSERT INTO users (id, email, name, avatar) VALUES ('u1','u1@example.com','阿泽','/avatar/u1.png')",
	).run();
	const member = { id: "u1", name: "阿泽", avatar: "/avatar/u1.png" };

	await submitComment(
		d1,
		{ target: TARGET, content: "待审一", guestName: "路人甲" },
		null,
	);
	await submitComment(
		d1,
		{ target: TARGET, content: "待审二", guestName: "路人乙" },
		null,
	);
	await submitComment(d1, { target: TARGET, content: "已通过" }, member);
	const spam = await submitComment(
		d1,
		{ target: TARGET, content: "广告" },
		member,
	);
	await moderateComment(d1, spam.comment.id, "spam");
	const removed = await submitComment(
		d1,
		{ target: TARGET, content: "将删除" },
		member,
	);
	await moderateComment(d1, removed.comment.id, "delete");
}

beforeEach(async () => {
	h.admin = true;
	db = new DatabaseSync(":memory:");
	applyMigrations(db);
	d1 = makeD1(db) as unknown as D1Database;
	h.env.DB = d1;
	await seed();
});

describe("getAdminCommentsOverview：一次往返返回计数+列表", () => {
	it("计数覆盖四种状态，列表只含指定状态，total 与计数一致", async () => {
		const { db: batched, state } = withBatch(makeD1(db));
		const out = await getAdminCommentsOverview(batched, {
			status: "pending",
			page: 1,
			pageSize: 20,
		});

		expect(out.counts).toEqual({
			pending: 2,
			approved: 1,
			spam: 1,
			deleted: 1,
		});
		expect(out.status).toBe("pending");
		expect(out.total).toBe(2);
		expect(out.items).toHaveLength(2);
		expect(out.items.every((c) => c.status === "pending")).toBe(true);
		// 分组计数 + 当页列表 = 一次 batch 往返
		expect(state.calls).toBe(1);
		expect(state.statements).toBe(2);
	});

	it("无 batch() 的 dev shim 退回串行，结果与 batch 分支完全一致", async () => {
		const serial = await getAdminCommentsOverview(d1, {
			status: "approved",
			page: 1,
			pageSize: 20,
		});
		const batched = await getAdminCommentsOverview(withBatch(makeD1(db)).db, {
			status: "approved",
			page: 1,
			pageSize: 20,
		});
		expect(batched).toEqual(serial);
		expect(serial.counts.approved).toBe(1);
	});

	it("分页与筛选语义与原后台列表一致", async () => {
		const list = await listCommentsForAdmin(d1, {
			status: "pending",
			page: 2,
			pageSize: 1,
		});
		const out = await getAdminCommentsOverview(withBatch(makeD1(db)).db, {
			status: "pending",
			page: 2,
			pageSize: 1,
		});
		expect(out.items.map((c) => c.id)).toEqual(list.items.map((c) => c.id));
		expect(out.total).toBe(list.total);
		expect(out.page).toBe(2);
		expect(out.pageSize).toBe(1);
	});

	it("空库返回四个 0 计数与空列表", async () => {
		const empty = new DatabaseSync(":memory:");
		applyMigrations(empty);
		const out = await getAdminCommentsOverview(withBatch(makeD1(empty)).db, {
			status: "deleted",
		});
		expect(out.counts).toEqual({
			pending: 0,
			approved: 0,
			spam: 0,
			deleted: 0,
		});
		expect(out.total).toBe(0);
		expect(out.items).toEqual([]);
	});

	it("非法状态被拒绝（两条路径一致）", async () => {
		await expect(
			getAdminCommentsOverview(d1, { status: "bogus" }),
		).rejects.toBeInstanceOf(UserError);
		await expect(
			listCommentsForAdmin(d1, { status: "bogus" }),
		).rejects.toBeInstanceOf(UserError);
	});
});

describe("GET /api/comments/admin/overview/ 路由", () => {
	function call(path: string, search = "") {
		const url = new URL(`https://x/api/comments/${path}?${search}`);
		return {
			params: { path },
			request: new Request(url),
			url,
		} as never;
	}

	it("无后台权限 → 401，与原后台列表接口一致", async () => {
		const mod = await import("../src/pages/api/comments/[...path].ts");
		h.admin = false;
		expect(
			(await mod.GET(call("admin/overview", "status=pending"))).status,
		).toBe(401);
		expect((await mod.GET(call("admin", "status=pending"))).status).toBe(401);
	});

	it("有权限 → 200 且返回 counts/status/items/total/page/pageSize", async () => {
		const mod = await import("../src/pages/api/comments/[...path].ts");
		const res = await mod.GET(
			call("admin/overview", "status=spam&page=1&pageSize=20"),
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.counts).toEqual({
			pending: 2,
			approved: 1,
			spam: 1,
			deleted: 1,
		});
		expect(body.status).toBe("spam");
		expect(body.total).toBe(1);
		expect(body.page).toBe(1);
		expect(body.pageSize).toBe(20);
		expect((body.items as unknown[]).length).toBe(1);
	});

	it("原 /admin/ 接口保留：仍只返回列表，不带 counts", async () => {
		const mod = await import("../src/pages/api/comments/[...path].ts");
		const res = await mod.GET(
			call("admin", "status=pending&page=1&pageSize=20"),
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.counts).toBeUndefined();
		expect(body.total).toBe(2);
	});

	it("非法状态 → 400（UserError 语义不变）", async () => {
		const mod = await import("../src/pages/api/comments/[...path].ts");
		const res = await mod.GET(call("admin/overview", "status=bogus"));
		expect(res.status).toBe(400);
	});
});

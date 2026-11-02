import { DatabaseSync } from "node:sqlite";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
	buildAbility,
	isKnownPerm,
	listRequestsForAdmin,
	listUserPerms,
	PERM_CATALOG,
	PERM_IDS,
	requestPerm,
	resolveBackendActor,
	reviewPermRequest,
	revokePerm,
} from "../server/auth/perms";
import {
	createSessionToken,
	USER_SESSION_COOKIE,
} from "../server/auth/userSession";
import type { CloudflareEnv } from "../types/env";
import { makeD1 } from "./helpers/d1";
import { applyMigrations } from "./helpers/migrations";

let db: DatabaseSync;

const env = () =>
	({
		DB: makeD1(db),
		USER_SESSION_SECRET: "test-user-secret",
		SESSION_SECRET: "test-admin-secret",
	}) as unknown as CloudflareEnv;

beforeAll(() => {
	db = new DatabaseSync(":memory:");
	applyMigrations(db);
});

beforeEach(() => {
	db.exec("DELETE FROM user_permissions");
	db.exec("DELETE FROM permission_requests");
	db.exec("DELETE FROM users");
});

function seedUser(
	id: string,
	role = "user",
	banned = 0,
	password = "hash-1",
): void {
	db.prepare(
		"INSERT INTO users (id, email, name, password, role, banned) VALUES (?, ?, ?, ?, ?, ?)",
	).run(id, `${id}@example.com`, `昵称-${id}`, password, role, banned);
}

function grant(userId: string, perm: string, by = "admin"): void {
	db.prepare(
		"INSERT INTO user_permissions (user_id, perm, granted_by) VALUES (?, ?, ?)",
	).run(userId, perm, by);
}

function pendingRequest(userId: string, perm: string, note = ""): string {
	const id = `req-${userId}-${perm}`;
	db.prepare(
		"INSERT INTO permission_requests (id, user_id, perm, status, note) VALUES (?, ?, ?, 'pending', ?)",
	).run(id, userId, perm, note);
	return id;
}

function backendRequest(token: string): Request {
	return new Request("https://example.com/api/backend/me/", {
		headers: { Cookie: `${USER_SESSION_COOKIE}=${token}` },
	});
}

describe("权限点目录", () => {
	it("post:create 已登记，未知权限点被拒绝", () => {
		expect(PERM_IDS).toContain("post:create");
		expect(isKnownPerm("post:create")).toBe(true);
		expect(isKnownPerm("post:delete")).toBe(false);
	});

	it("目录项均带标签、说明与能力声明", () => {
		for (const spec of PERM_CATALOG) {
			expect(spec.label.length).toBeGreaterThan(0);
			expect(spec.desc.length).toBeGreaterThan(0);
			expect(spec.grants.length).toBeGreaterThan(0);
		}
	});
});

describe("buildAbility", () => {
	it("admin 拥有全部能力", () => {
		const ability = buildAbility("admin", []);
		expect(ability.can("manage", "all")).toBe(true);
		expect(ability.can("delete", "Backend")).toBe(true);
	});

	it("post:create 授予文章 CRUD 与后台读取，不授予后台删除", () => {
		const ability = buildAbility("user", ["post:create"]);
		expect(ability.can("create", "Post")).toBe(true);
		expect(ability.can("update", "Post")).toBe(true);
		expect(ability.can("read", "Backend")).toBe(true);
		expect(ability.can("delete", "Backend")).toBe(false);
	});

	it("无权限点的普通用户不能进后台", () => {
		const ability = buildAbility("user", []);
		expect(ability.can("read", "Backend")).toBe(false);
		expect(ability.can("create", "Post")).toBe(false);
	});
});

describe("listUserPerms", () => {
	it("只返回目录内的权限点", async () => {
		seedUser("u1");
		grant("u1", "post:create");
		grant("u1", "legacy:unknown");
		await expect(listUserPerms(makeD1(db) as never, "u1")).resolves.toEqual([
			"post:create",
		]);
	});

	it("无记录返回空数组", async () => {
		seedUser("u2");
		await expect(listUserPerms(makeD1(db) as never, "u2")).resolves.toEqual([]);
	});
});

describe("requestPerm", () => {
	beforeEach(() => seedUser("u1"));

	it("拒绝未知权限点", async () => {
		const out = await requestPerm(makeD1(db) as never, "u1", "post:delete");
		expect(out.ok).toBe(false);
	});

	it("提交后落库为 pending", async () => {
		const out = await requestPerm(
			makeD1(db) as never,
			"u1",
			"post:create",
			"想投稿",
		);
		expect(out.ok).toBe(true);
		const row = db
			.prepare("SELECT status, note FROM permission_requests WHERE user_id = ?")
			.get("u1") as { status: string; note: string } | undefined;
		expect(row).toEqual({ status: "pending", note: "想投稿" });
	});

	it("同权限点已有 pending 时去重", async () => {
		await requestPerm(makeD1(db) as never, "u1", "post:create");
		const again = await requestPerm(makeD1(db) as never, "u1", "post:create");
		expect(again.ok).toBe(false);
		const count = db
			.prepare("SELECT COUNT(*) AS n FROM permission_requests")
			.get() as { n: number };
		expect(count.n).toBe(1);
	});

	it("已授予的权限点不再接受申请", async () => {
		grant("u1", "post:create");
		const out = await requestPerm(makeD1(db) as never, "u1", "post:create");
		expect(out.ok).toBe(false);
	});

	it("被拒绝后可重新申请", async () => {
		db.prepare(
			"INSERT INTO permission_requests (id, user_id, perm, status) VALUES ('old', 'u1', 'post:create', 'denied')",
		).run();
		const out = await requestPerm(makeD1(db) as never, "u1", "post:create");
		expect(out.ok).toBe(true);
	});

	it("note 超过 200 字被截断", async () => {
		const out = await requestPerm(
			makeD1(db) as never,
			"u1",
			"post:create",
			"长".repeat(260),
		);
		expect(out.ok).toBe(true);
		const row = db
			.prepare("SELECT note FROM permission_requests WHERE id = ?")
			.get((out as { request: { id: string } }).request.id) as { note: string };
		expect(row.note).toHaveLength(200);
	});
});

describe("reviewPermRequest", () => {
	beforeEach(() => seedUser("u1"));

	it("通过时写入 user_permissions 并记录审批人", async () => {
		const id = pendingRequest("u1", "post:create");
		const out = await reviewPermRequest(
			makeD1(db) as never,
			id,
			"approve",
			"boss",
		);
		expect(out).toEqual({ ok: true, perm: "post:create" });

		const req = db
			.prepare(
				"SELECT status, reviewed_by FROM permission_requests WHERE id = ?",
			)
			.get(id) as { status: string; reviewed_by: string };
		expect(req.status).toBe("approved");
		expect(req.reviewed_by).toBe("boss");

		const granted = db
			.prepare(
				"SELECT granted_by FROM user_permissions WHERE user_id = ? AND perm = ?",
			)
			.get("u1", "post:create") as { granted_by: string } | undefined;
		expect(granted?.granted_by).toBe("boss");
	});

	it("重复审批幂等失败且不重复授权", async () => {
		const id = pendingRequest("u1", "post:create");
		await reviewPermRequest(makeD1(db) as never, id, "approve", "boss");
		const second = await reviewPermRequest(
			makeD1(db) as never,
			id,
			"approve",
			"boss2",
		);
		expect(second.ok).toBe(false);
		const count = db
			.prepare("SELECT COUNT(*) AS n FROM user_permissions")
			.get() as { n: number };
		expect(count.n).toBe(1);
	});

	it("拒绝不写授权", async () => {
		const id = pendingRequest("u1", "post:create");
		const out = await reviewPermRequest(
			makeD1(db) as never,
			id,
			"deny",
			"boss",
		);
		expect(out.ok).toBe(true);
		const count = db
			.prepare("SELECT COUNT(*) AS n FROM user_permissions")
			.get() as { n: number };
		expect(count.n).toBe(0);
	});

	it("申请不存在时返回失败", async () => {
		const out = await reviewPermRequest(
			makeD1(db) as never,
			"nope",
			"approve",
			"boss",
		);
		expect(out.ok).toBe(false);
	});
});

describe("revokePerm 与审批列表", () => {
	beforeEach(() => seedUser("u1"));

	it("撤销后权限消失，列表 granted 变为 false", async () => {
		const id = pendingRequest("u1", "post:create");
		await reviewPermRequest(makeD1(db) as never, id, "approve", "boss");

		const before = await listRequestsForAdmin(makeD1(db) as never, {
			status: "all",
		});
		expect(before.items[0].granted).toBe(true);
		expect(before.items[0].permLabel).toBe("发布文章");
		expect(before.items[0].userName).toBe("昵称-u1");

		await revokePerm(makeD1(db) as never, "u1", "post:create");
		await expect(listUserPerms(makeD1(db) as never, "u1")).resolves.toEqual([]);

		const after = await listRequestsForAdmin(makeD1(db) as never, {
			status: "all",
		});
		expect(after.items[0].granted).toBe(false);
	});

	it("按状态过滤并分页", async () => {
		seedUser("u2");
		pendingRequest("u1", "post:create");
		db.prepare(
			"INSERT INTO permission_requests (id, user_id, perm, status) VALUES ('r2','u2','post:create','denied')",
		).run();
		db.prepare(
			"INSERT INTO permission_requests (id, user_id, perm, status) VALUES ('r3','u2','post:create','approved')",
		).run();

		const pending = await listRequestsForAdmin(makeD1(db) as never, {
			status: "pending",
		});
		expect(pending.total).toBe(1);
		expect(pending.items[0].status).toBe("pending");

		const all = await listRequestsForAdmin(makeD1(db) as never, {
			status: "all",
			page: 1,
			pageSize: 2,
		});
		expect(all.total).toBe(3);
		expect(all.items).toHaveLength(2);
		expect(all.items[0].status).toBe("pending");
	});
});

describe("resolveBackendActor", () => {
	it("未带会话返回 null", async () => {
		const req = new Request("https://example.com/api/backend/me/");
		await expect(resolveBackendActor(req, env())).resolves.toBeNull();
	});

	it("无权限的普通用户返回 null", async () => {
		seedUser("u1");
		const token = await createSessionToken("u1", "user", env());
		await expect(
			resolveBackendActor(backendRequest(token), env()),
		).resolves.toBeNull();
	});

	it("持有 post:create 的普通用户可进后台", async () => {
		seedUser("u1");
		grant("u1", "post:create");
		const token = await createSessionToken("u1", "user", env());
		const actor = await resolveBackendActor(backendRequest(token), env());
		expect(actor?.isAdmin).toBe(false);
		expect(actor?.canAccessBackend).toBe(true);
		expect(actor?.perms).toEqual(["post:create"]);
		expect(actor?.ability.can("create", "Post")).toBe(true);
		expect(actor?.ability.can("manage", "all")).toBe(false);
	});

	it("role=admin 的用户即是管理员", async () => {
		seedUser("root", "admin");
		const token = await createSessionToken("root", "admin", env());
		const actor = await resolveBackendActor(backendRequest(token), env());
		expect(actor?.isAdmin).toBe(true);
		expect(actor?.canAccessBackend).toBe(true);
		expect(actor?.ability.can("manage", "all")).toBe(true);
	});

	it("封禁用户一律拒绝", async () => {
		seedUser("u1", "user", 1);
		grant("u1", "post:create");
		const token = await createSessionToken("u1", "user", env());
		await expect(
			resolveBackendActor(backendRequest(token), env()),
		).resolves.toBeNull();
	});

	it("伪造签名的 token 被拒绝", async () => {
		seedUser("u1", "admin");
		const token = await createSessionToken("u1", "admin", env());
		const tampered = `${token.split(".")[0]}.forged`;
		await expect(
			resolveBackendActor(backendRequest(tampered), env()),
		).resolves.toBeNull();
	});
});

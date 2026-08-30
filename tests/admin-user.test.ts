import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import bcrypt from "bcryptjs";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
	authenticateAdmin,
	createAdminUser,
	deleteAdminUser,
	getAdminUserByUsername,
	listAdminUsers,
	setAdminUserEnabled,
	updateAdminUserPassword,
	verifyAdminUserCredentials,
} from "../server/auth/adminUser";
import { hashPassword } from "../server/auth/adminSession";

/**
 * 后台用户管理（D1 存储）测试：
 * 应用 migrations/*.sql 到内存 SQLite，验证 admin_users 表的创建/校验/改密/启禁用/删除，
 * 以及登录鉴权编排（D1 优先 + Secrets 兜底 + 平滑迁移）。
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
});

const env = () => ({ DB: makeD1(db) });

describe("admin_users 表：创建与校验", () => {
	beforeEach(() => {
		db.exec("DELETE FROM admin_users");
	});

	it("迁移后 admin_users 表存在", () => {
		const row = db
			.prepare(
				"SELECT name FROM sqlite_master WHERE type='table' AND name='admin_users'",
			)
			.get() as { name: string } | undefined;
		expect(row?.name).toBe("admin_users");
	});

	it("createAdminUser 创建用户，密码存 bcrypt 哈希", async () => {
		const result = await createAdminUser(makeD1(db) as never, "admin", "secret-123");
		expect(result).toEqual({ ok: true });

		const row = await getAdminUserByUsername(makeD1(db) as never, "admin");
		expect(row?.username).toBe("admin");
		expect(row?.enabled).toBe(1);
		// 密码应存为 bcrypt 哈希，非明文
		expect(row?.password_hash).not.toBe("secret-123");
		expect(row?.password_hash).toMatch(/^\$2[aby]\$/);
	});

	it("createAdminUser 拒绝重复用户名", async () => {
		await createAdminUser(makeD1(db) as never, "admin", "pass-1");
		const result = await createAdminUser(makeD1(db) as never, "admin", "pass-2");
		expect(result).toEqual({ ok: false, conflict: true });
	});

	it("verifyAdminUserCredentials 正确/错误密码校验", async () => {
		await createAdminUser(makeD1(db) as never, "admin", "correct-pass");
		expect(
			await verifyAdminUserCredentials(makeD1(db) as never, "admin", "correct-pass"),
		).toBe(true);
		expect(
			await verifyAdminUserCredentials(makeD1(db) as never, "admin", "wrong-pass"),
		).toBe(false);
		expect(
			await verifyAdminUserCredentials(makeD1(db) as never, "ghost", "x"),
		).toBe(false);
	});

	it("禁用用户无法通过校验", async () => {
		await createAdminUser(makeD1(db) as never, "admin", "pass");
		await setAdminUserEnabled(makeD1(db) as never, "admin", false);
		expect(
			await verifyAdminUserCredentials(makeD1(db) as never, "admin", "pass"),
		).toBe(false);
		// 启用后可登录
		await setAdminUserEnabled(makeD1(db) as never, "admin", true);
		expect(
			await verifyAdminUserCredentials(makeD1(db) as never, "admin", "pass"),
		).toBe(true);
	});
});

describe("admin_users 表：改密 / 启禁用 / 删除 / 列表", () => {
	beforeEach(() => {
		db.exec("DELETE FROM admin_users");
	});

	it("updateAdminUserPassword 修改后旧密码失效", async () => {
		await createAdminUser(makeD1(db) as never, "admin", "old-pass");
		expect(await updateAdminUserPassword(makeD1(db) as never, "admin", "new-pass")).toBe(true);
		expect(
			await verifyAdminUserCredentials(makeD1(db) as never, "admin", "old-pass"),
		).toBe(false);
		expect(
			await verifyAdminUserCredentials(makeD1(db) as never, "admin", "new-pass"),
		).toBe(true);
	});

	it("setAdminUserEnabled 切换 enabled", async () => {
		await createAdminUser(makeD1(db) as never, "a", "p");
		await setAdminUserEnabled(makeD1(db) as never, "a", false);
		const row = await getAdminUserByUsername(makeD1(db) as never, "a");
		expect(row?.enabled).toBe(0);
	});

	it("deleteAdminUser 删除后不可校验", async () => {
		await createAdminUser(makeD1(db) as never, "temp", "p");
		expect(await deleteAdminUser(makeD1(db) as never, "temp")).toBe(true);
		expect(
			await verifyAdminUserCredentials(makeD1(db) as never, "temp", "p"),
		).toBe(false);
	});

	it("listAdminUsers 返回公开结构（不含哈希）", async () => {
		await createAdminUser(makeD1(db) as never, "admin", "p1");
		await createAdminUser(makeD1(db) as never, "editor", "p2");
		const users = await listAdminUsers(makeD1(db) as never);
		expect(users.map((u) => u.username).sort()).toEqual(["admin", "editor"]);
		expect(users[0]).not.toHaveProperty("password_hash");
	});
});

describe("authenticateAdmin：D1 优先 + Secrets 兜底 + 平滑迁移", () => {
	beforeEach(() => {
		db.exec("DELETE FROM admin_users");
	});

	it("D1 有用户时用 D1 校验（忽略 Secrets）", async () => {
		const dbHash = await hashPassword("db-pass");
		await createAdminUser(makeD1(db) as never, "admin", "db-pass");
		const envObj = {
			DB: makeD1(db),
			ADMIN_USERNAME: "admin",
			ADMIN_PASSWORD: await hashPassword("secret-pass"),
		};
		// D1 密码正确 → 通过（即使 Secrets 密码不同）
		expect(await authenticateAdmin(envObj as never, makeD1(db), "admin", "db-pass")).toBe(true);
		// D1 密码错误 → 拒绝
		expect(await authenticateAdmin(envObj as never, makeD1(db), "admin", "secret-pass")).toBe(false);
		expect(dbHash).toBeTruthy();
	});

	it("D1 无用户时回落 Secrets 校验，并在成功后落库迁移", async () => {
		const secretHash = await hashPassword("secret-pass");
		const envObj = {
			DB: makeD1(db),
			ADMIN_USERNAME: "admin",
			ADMIN_PASSWORD: secretHash,
		};
		// Secrets 密码正确 → 通过并落库
		expect(
			await authenticateAdmin(envObj as never, makeD1(db), "admin", "secret-pass"),
		).toBe(true);
		const seeded = await getAdminUserByUsername(makeD1(db), "admin");
		expect(seeded?.username).toBe("admin");
		// 落库后 D1 成为权威：Secrets 密码修改也不影响
		expect(
			await verifyAdminUserCredentials(makeD1(db), "admin", "secret-pass"),
		).toBe(true);
	});

	it("D1 无用户且 Secrets 校验失败 → 拒绝且不落库", async () => {
		const envObj = {
			DB: makeD1(db),
			ADMIN_USERNAME: "admin",
			ADMIN_PASSWORD: await hashPassword("real-pass"),
		};
		expect(
			await authenticateAdmin(envObj as never, makeD1(db), "admin", "wrong"),
		).toBe(false);
		expect(await getAdminUserByUsername(makeD1(db), "admin")).toBeNull();
	});
});

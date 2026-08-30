import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
	authenticateAdmin,
	createAdminUser,
	hasAdminUser,
	getAdminUserByUsername,
	listAdminUsers,
	updateAdminUserPassword,
	verifyAdminUserCredentials,
} from "../server/auth/adminUser";

/**
 * 后台管理员用户（D1 存储，单用户模型）测试：
 * - 首次创建唯一管理员（初始化）
 * - 已有管理员后禁止重复创建
 * - 改密
 * - 登录鉴权（D1 唯一管理员 bcrypt + enabled）
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

describe("admin_users 表：首次创建唯一管理员", () => {
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

	it("hasAdminUser 空表返回 false，创建后返回 true", async () => {
		expect(await hasAdminUser(makeD1(db) as never)).toBe(false);
		await createAdminUser(makeD1(db) as never, "admin", "secret-123");
		expect(await hasAdminUser(makeD1(db) as never)).toBe(true);
	});

	it("首个用户创建成功，密码存 bcrypt 哈希", async () => {
		const result = await createAdminUser(makeD1(db) as never, "admin", "secret-123");
		expect(result).toEqual({ ok: true });

		const row = await getAdminUserByUsername(makeD1(db) as never, "admin");
		expect(row?.username).toBe("admin");
		expect(row?.enabled).toBe(1);
		expect(row?.password_hash).not.toBe("secret-123");
		expect(row?.password_hash).toMatch(/^\$2[aby]\$/);
	});

	it("已有管理员后禁止再创建第二个用户（单用户模型）", async () => {
		await createAdminUser(makeD1(db) as never, "admin", "pass-1");
		const result = await createAdminUser(makeD1(db) as never, "editor", "pass-2");
		expect(result).toEqual({ ok: false, conflict: true });
		// 且不能创建同名用户
		const dup = await createAdminUser(makeD1(db) as never, "admin", "pass-3");
		expect(dup).toEqual({ ok: false, conflict: true });
		// 确认仅一个用户
		const users = await listAdminUsers(makeD1(db) as never);
		expect(users.length).toBe(1);
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
});

describe("admin_users 表：改密 / 列表", () => {
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

	it("listAdminUsers 返回公开结构（不含哈希），且恒为单用户", async () => {
		await createAdminUser(makeD1(db) as never, "admin", "p1");
		const users = await listAdminUsers(makeD1(db) as never);
		expect(users.length).toBe(1);
		expect(users[0].username).toBe("admin");
		expect(users[0]).not.toHaveProperty("password_hash");
	});
});

describe("authenticateAdmin：D1 唯一管理员", () => {
	beforeEach(() => {
		db.exec("DELETE FROM admin_users");
	});

	it("D1 无用户 → 登录失败（引导初始化）", async () => {
		expect(
			await authenticateAdmin(env() as never, makeD1(db), "admin", "x"),
		).toBe(false);
	});

	it("D1 有用户 → 密码正确通过、错误拒绝", async () => {
		await createAdminUser(makeD1(db) as never, "admin", "db-pass");
		expect(
			await authenticateAdmin(env() as never, makeD1(db), "admin", "db-pass"),
		).toBe(true);
		expect(
			await authenticateAdmin(env() as never, makeD1(db), "admin", "wrong"),
		).toBe(false);
	});

	it("禁用用户无法登录（enabled 检查）", async () => {
		await createAdminUser(makeD1(db) as never, "admin", "pass");
		db.prepare("UPDATE admin_users SET enabled = 0 WHERE username = 'admin'").run();
		expect(
			await authenticateAdmin(env() as never, makeD1(db), "admin", "pass"),
		).toBe(false);
	});
});

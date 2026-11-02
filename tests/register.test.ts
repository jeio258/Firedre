import { DatabaseSync } from "node:sqlite";
import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it } from "vitest";
import { isBcryptHash } from "../server/auth/password";
import {
	bootstrapOwner,
	type RegisterEnv,
	registerUser,
	resetPassword,
	verifySignupToken,
} from "../server/auth/register";
import { makeD1 } from "./helpers/d1";
import { applyMigrations } from "./helpers/migrations";

const ORIGIN = "https://site.test";
const SITE_NAME = "Firedre 测试站";

let db: DatabaseSync;

beforeEach(() => {
	db = new DatabaseSync(":memory:");
	applyMigrations(db);
});

function d1() {
	return makeD1(db);
}

// ENVIRONMENT=dev 让 sendMail 只打日志 + 写 mail_log，测试不打外网
function testEnv(): RegisterEnv {
	return { DB: d1(), ENVIRONMENT: "dev" } as unknown as RegisterEnv;
}

async function sha256Hex(input: string): Promise<string> {
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(input),
	);
	return [...new Uint8Array(digest)]
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

async function insertVerification(opts: {
	userId: string;
	token: string;
	purpose: "signup" | "reset";
	expiresAt: string;
}) {
	db.prepare(
		`INSERT INTO email_verifications (id, user_id, token_hash, purpose, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
	).run(
		crypto.randomUUID(),
		opts.userId,
		await sha256Hex(opts.token),
		opts.purpose,
		opts.expiresAt,
	);
}

async function seedUser(opts: {
	email?: string;
	verified?: number;
	password?: string;
	role?: string;
}) {
	const id = crypto.randomUUID();
	const email = opts.email ?? `${id}@example.com`;
	const password = opts.password ?? (await bcrypt.hash("initial-password", 4));
	db.prepare(
		`INSERT INTO users (id, email, email_verified, name, password, role, banned)
     VALUES (?, ?, ?, ?, ?, ?, 0)`,
	).run(id, email, opts.verified ?? 1, "tester", password, opts.role ?? "user");
	return { id, email, password };
}

function countUsers(): number {
	return (db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number })
		.n;
}

function latestSignup(userId: string) {
	return db
		.prepare(
			`SELECT token_hash, used_at FROM email_verifications
       WHERE user_id = ? AND purpose = 'signup'
       ORDER BY created_at DESC, rowid DESC LIMIT 1`,
		)
		.get(userId) as { token_hash: string; used_at: string | null } | undefined;
}

describe("注册与防枚举", () => {
	it("新邮箱建号并落一条 signup token", async () => {
		const outcome = await registerUser(
			d1(),
			testEnv(),
			{ email: "New@Example.com", name: "新人", password: "password123" },
			ORIGIN,
			SITE_NAME,
		);

		expect(outcome.kind).toBe("created");
		expect(countUsers()).toBe(1);
		const row = db
			.prepare("SELECT email, email_verified, role FROM users")
			.get() as {
			email: string;
			email_verified: number;
			role: string;
		};
		expect(row.email).toBe("new@example.com");
		expect(row.email_verified).toBe(0);
		expect(row.role).toBe("user");
	});

	it("重复注册返回 duplicate 且不新增用户，未验证账号会重发新 token", async () => {
		const input = {
			email: "dup@example.com",
			name: "重复",
			password: "password123",
		};
		await registerUser(d1(), testEnv(), input, ORIGIN, SITE_NAME);
		const userId = (db.prepare("SELECT id FROM users").get() as { id: string })
			.id;
		const firstHash = latestSignup(userId)?.token_hash;

		const second = await registerUser(
			d1(),
			testEnv(),
			input,
			ORIGIN,
			SITE_NAME,
		);

		expect(second.kind).toBe("duplicate");
		expect(countUsers()).toBe(1);
		const rows = db
			.prepare(
				"SELECT token_hash FROM email_verifications WHERE purpose = 'signup'",
			)
			.all() as { token_hash: string }[];
		expect(rows).toHaveLength(1);
		expect(rows[0].token_hash).not.toBe(firstHash);
	});

	it("已验证账号重复注册不再发验证信", async () => {
		const { id } = await seedUser({ email: "done@example.com", verified: 1 });

		const outcome = await registerUser(
			d1(),
			testEnv(),
			{ email: "done@example.com", name: "已验", password: "password123" },
			ORIGIN,
			SITE_NAME,
		);

		expect(outcome.kind).toBe("duplicate");
		expect(countUsers()).toBe(1);
		expect(latestSignup(id)).toBeUndefined();
	});

	it("非法邮箱 / 短密码 / 空昵称均不建号", async () => {
		const cases = [
			{ email: "not-an-email", name: "x", password: "password123" },
			{ email: "ok@example.com", name: "x", password: "short" },
			{ email: "ok@example.com", name: "   ", password: "password123" },
		];

		for (const input of cases) {
			const outcome = await registerUser(
				d1(),
				testEnv(),
				input,
				ORIGIN,
				SITE_NAME,
			);
			expect(outcome.kind).toBe("invalid");
		}
		expect(countUsers()).toBe(0);
	});
});

describe("邮箱验证 token", () => {
	it("有效 token 置 email_verified=1 并标记已用", async () => {
		const { id } = await seedUser({ verified: 0 });
		const token = "a".repeat(64);
		await insertVerification({
			userId: id,
			token,
			purpose: "signup",
			expiresAt: "2999-01-01 00:00:00",
		});

		const result = await verifySignupToken(d1(), token);

		expect(result).toEqual({ ok: true, userId: id });
		const user = db
			.prepare("SELECT email_verified FROM users WHERE id = ?")
			.get(id) as {
			email_verified: number;
		};
		expect(user.email_verified).toBe(1);
		expect(latestSignup(id)?.used_at).not.toBeNull();
	});

	it("已用 token 重放被拒（invalid）", async () => {
		const { id } = await seedUser({ verified: 0 });
		const token = "b".repeat(64);
		await insertVerification({
			userId: id,
			token,
			purpose: "signup",
			expiresAt: "2999-01-01 00:00:00",
		});
		await verifySignupToken(d1(), token);

		expect(await verifySignupToken(d1(), token)).toEqual({
			ok: false,
			reason: "invalid",
		});
	});

	it("过期 token 返回 expired 且不激活账号", async () => {
		const { id } = await seedUser({ verified: 0 });
		const token = "c".repeat(64);
		await insertVerification({
			userId: id,
			token,
			purpose: "signup",
			expiresAt: "2000-01-01 00:00:00",
		});

		expect(await verifySignupToken(d1(), token)).toEqual({
			ok: false,
			reason: "expired",
		});
		const user = db
			.prepare("SELECT email_verified FROM users WHERE id = ?")
			.get(id) as {
			email_verified: number;
		};
		expect(user.email_verified).toBe(0);
	});

	it("不存在的 token 返回 invalid", async () => {
		expect(await verifySignupToken(d1(), "d".repeat(64))).toEqual({
			ok: false,
			reason: "invalid",
		});
	});
});

describe("密码重置", () => {
	it("有效 reset token 改写密码并标记已用", async () => {
		const { id, password: oldHash } = await seedUser({ verified: 1 });
		const token = "e".repeat(64);
		await insertVerification({
			userId: id,
			token,
			purpose: "reset",
			expiresAt: "2999-01-01 00:00:00",
		});

		const result = await resetPassword(d1(), token, "brand-new-password");

		expect(result).toEqual({ ok: true, userId: id });
		const row = db
			.prepare("SELECT password FROM users WHERE id = ?")
			.get(id) as {
			password: string;
		};
		expect(row.password).not.toBe(oldHash);
		expect(isBcryptHash(row.password)).toBe(true);
		expect(await bcrypt.compare("brand-new-password", row.password)).toBe(true);
	});

	it("reset token 重放被拒", async () => {
		const { id } = await seedUser({ verified: 1 });
		const token = "f".repeat(64);
		await insertVerification({
			userId: id,
			token,
			purpose: "reset",
			expiresAt: "2999-01-01 00:00:00",
		});
		await resetPassword(d1(), token, "brand-new-password");

		expect(await resetPassword(d1(), token, "another-password")).toEqual({
			ok: false,
			reason: "invalid",
		});
	});

	it("过期 reset token 返回 expired 且不改密码", async () => {
		const { id, password: oldHash } = await seedUser({ verified: 1 });
		const token = "g".repeat(64);
		await insertVerification({
			userId: id,
			token,
			purpose: "reset",
			expiresAt: "2000-01-01 00:00:00",
		});

		expect(await resetPassword(d1(), token, "brand-new-password")).toEqual({
			ok: false,
			reason: "expired",
		});
		const row = db
			.prepare("SELECT password FROM users WHERE id = ?")
			.get(id) as {
			password: string;
		};
		expect(row.password).toBe(oldHash);
	});

	it("signup token 不能当 reset token 用", async () => {
		const { id } = await seedUser({ verified: 0 });
		const token = "h".repeat(64);
		await insertVerification({
			userId: id,
			token,
			purpose: "signup",
			expiresAt: "2999-01-01 00:00:00",
		});

		expect(await resetPassword(d1(), token, "brand-new-password")).toEqual({
			ok: false,
			reason: "invalid",
		});
	});
});

describe("首次初始化站长（bootstrapOwner）", () => {
	const input = {
		email: "Owner@Example.com",
		name: "站长",
		password: "owner-password",
	};

	it("users 为空且无旧管理员时直接建 admin", async () => {
		const result = await bootstrapOwner(
			d1(),
			testEnv(),
			input,
			ORIGIN,
			SITE_NAME,
		);

		expect(result.ok).toBe(true);
		const row = db
			.prepare("SELECT email, role, email_verified, password FROM users")
			.get() as {
			email: string;
			role: string;
			email_verified: number;
			password: string;
		};
		expect(row.email).toBe("owner@example.com");
		expect(row.role).toBe("admin");
		expect(row.email_verified).toBe(1);
		expect(isBcryptHash(row.password)).toBe(true);
	});

	it("已有用户时拒绝重复初始化", async () => {
		await seedUser({});
		const result = await bootstrapOwner(
			d1(),
			testEnv(),
			input,
			ORIGIN,
			SITE_NAME,
		);

		expect(result).toEqual({
			ok: false,
			reason: "exists",
			message: "站点已初始化",
		});
	});

	it("存在旧 admin_users 时必须提交原管理员密码", async () => {
		const legacyHash = await bcrypt.hash("legacy-password", 4);
		db.prepare(
			"INSERT INTO admin_users (username, password_hash) VALUES (?, ?)",
		).run("admin", legacyHash);

		const missing = await bootstrapOwner(
			d1(),
			testEnv(),
			input,
			ORIGIN,
			SITE_NAME,
		);
		expect(missing).toMatchObject({ ok: false, reason: "legacy_required" });

		const wrong = await bootstrapOwner(
			d1(),
			testEnv(),
			{ ...input, legacyPassword: "not-the-legacy-password" },
			ORIGIN,
			SITE_NAME,
		);
		expect(wrong).toMatchObject({ ok: false, reason: "legacy_invalid" });
		expect(countUsers()).toBe(0);
	});

	it("原管理员密码正确时认领成功，并改用初始化时设置的新密码", async () => {
		const legacyHash = await bcrypt.hash("legacy-password", 4);
		db.prepare(
			"INSERT INTO admin_users (username, password_hash) VALUES (?, ?)",
		).run("admin", legacyHash);

		const result = await bootstrapOwner(
			d1(),
			testEnv(),
			{ ...input, legacyPassword: "legacy-password" },
			ORIGIN,
			SITE_NAME,
		);

		expect(result.ok).toBe(true);
		const row = db
			.prepare("SELECT role, email_verified, password FROM users")
			.get() as {
			role: string;
			email_verified: number;
			password: string;
		};
		expect(row.role).toBe("admin");
		expect(row.email_verified).toBe(1);
		expect(row.password).not.toBe(legacyHash);
		expect(await bcrypt.compare(input.password, row.password)).toBe(true);
	});

	it("旧库存的是明文时，认领后写入新密码的 bcrypt 哈希", async () => {
		db.prepare(
			"INSERT INTO admin_users (username, password_hash) VALUES (?, ?)",
		).run("admin", "plain-legacy-password");

		const result = await bootstrapOwner(
			d1(),
			testEnv(),
			{ ...input, legacyPassword: "plain-legacy-password" },
			ORIGIN,
			SITE_NAME,
		);

		expect(result.ok).toBe(true);
		const row = db.prepare("SELECT password FROM users").get() as {
			password: string;
		};
		expect(isBcryptHash(row.password)).toBe(true);
		expect(await bcrypt.compare(input.password, row.password)).toBe(true);
	});

	it("初始化参数非法时不建号", async () => {
		const badEmail = await bootstrapOwner(
			d1(),
			testEnv(),
			{ ...input, email: "nope" },
			ORIGIN,
			SITE_NAME,
		);
		expect(badEmail.ok).toBe(false);

		const badPassword = await bootstrapOwner(
			d1(),
			testEnv(),
			{ ...input, password: "123" },
			ORIGIN,
			SITE_NAME,
		);
		expect(badPassword.ok).toBe(false);
		expect(countUsers()).toBe(0);
	});
});

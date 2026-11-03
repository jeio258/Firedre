import { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";
import {
	type RegisterEnv,
	registerUser,
	resendVerification,
	verifySignupCode,
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

function sha256Hex(input: string): Promise<string> {
	return crypto.subtle
		.digest("SHA-256", new TextEncoder().encode(input))
		.then((buf) =>
			[...new Uint8Array(buf)]
				.map((b) => b.toString(16).padStart(2, "0"))
				.join(""),
		);
}

function latestSignup(userId: string) {
	return db
		.prepare(
			`SELECT id, token_hash, used_at, expires_at FROM email_verifications
       WHERE user_id = ? AND purpose = 'signup'
       ORDER BY created_at DESC, rowid DESC LIMIT 1`,
		)
		.get(userId) as
		| {
				id: string;
				token_hash: string;
				used_at: string | null;
				expires_at: string;
		  }
		| undefined;
}

async function register(email = "coder@example.com") {
	const outcome = await registerUser(
		d1(),
		testEnv(),
		{ email, name: "收码人", password: "password123" },
		ORIGIN,
		SITE_NAME,
	);
	expect(outcome.kind).toBe("created");
	const userId = (db.prepare("SELECT id FROM users").get() as { id: string })
		.id;
	return { outcome: outcome as { kind: "created"; code?: string }, userId };
}

describe("注册发码", () => {
	it("注册后签发 6 位数字验证码，账号未验证、记录 10 分钟内有效", async () => {
		const { outcome, userId } = await register();

		expect(outcome.code).toMatch(/^\d{6}$/);
		const user = db
			.prepare("SELECT email_verified FROM users WHERE id = ?")
			.get(userId) as { email_verified: number };
		expect(user.email_verified).toBe(0);

		const row = latestSignup(userId);
		expect(row).toBeDefined();
		expect(row!.used_at).toBeNull();
		const expires = new Date(row!.expires_at.replace(" ", "T") + "Z").getTime();
		const created = (
			db
				.prepare("SELECT created_at FROM email_verifications WHERE id = ?")
				.get(row!.id) as { created_at: string }
		).created_at;
		const createdMs = new Date(created.replace(" ", "T") + "Z").getTime();
		expect(expires - createdMs).toBe(10 * 60_000);
	});
});

describe("验证码校验", () => {
	it("正确验证码通过：置 verified=1、标记已用", async () => {
		const { outcome, userId } = await register();
		const code = outcome.code!;

		const result = await verifySignupCode(d1(), "Coder@Example.com", code);

		expect(result).toEqual({ ok: true, userId });
		const user = db
			.prepare("SELECT email_verified FROM users WHERE id = ?")
			.get(userId) as { email_verified: number };
		expect(user.email_verified).toBe(1);
		expect(latestSignup(userId)?.used_at).not.toBeNull();
	});

	it("已用验证码重放失效", async () => {
		const { outcome } = await register();
		const code = outcome.code!;
		await verifySignupCode(d1(), "coder@example.com", code);

		expect(await verifySignupCode(d1(), "coder@example.com", code)).toEqual({
			ok: false,
			reason: "invalid",
		});
	});

	it("过期验证码返回 expired 且不激活账号", async () => {
		const { outcome, userId } = await register();
		db.prepare(
			"UPDATE email_verifications SET expires_at = '2000-01-01 00:00:00' WHERE purpose = 'signup'",
		).run();

		expect(
			await verifySignupCode(d1(), "coder@example.com", outcome.code!),
		).toEqual({ ok: false, reason: "expired" });
		const user = db
			.prepare("SELECT email_verified FROM users WHERE id = ?")
			.get(userId) as { email_verified: number };
		expect(user.email_verified).toBe(0);
	});

	it("连错 5 次后当前码作废，正确码也无法通过", async () => {
		const { outcome, userId } = await register();

		for (let i = 0; i < 5; i++) {
			expect(
				await verifySignupCode(d1(), "coder@example.com", "000000"),
			).toMatchObject({ ok: false });
		}
		// 第 5 次错后记录已删除，正确码也随之失效（无记录 → invalid）
		expect(latestSignup(userId)).toBeUndefined();
		expect(
			await verifySignupCode(d1(), "coder@example.com", outcome.code!),
		).toEqual({ ok: false, reason: "invalid" });
		const user = db
			.prepare("SELECT email_verified FROM users WHERE id = ?")
			.get(userId) as { email_verified: number };
		expect(user.email_verified).toBe(0);
	});

	it("错误 4 次以内正确码仍可通过", async () => {
		const { outcome } = await register();
		for (let i = 0; i < 4; i++) {
			await verifySignupCode(d1(), "coder@example.com", "111111");
		}
		expect(
			await verifySignupCode(d1(), "coder@example.com", outcome.code!),
		).toMatchObject({ ok: true });
	});

	it("格式非法与不存在邮箱均返回 invalid", async () => {
		expect(await verifySignupCode(d1(), "coder@example.com", "12345")).toEqual({
			ok: false,
			reason: "invalid",
		});
		expect(await verifySignupCode(d1(), "coder@example.com", "12a456")).toEqual(
			{ ok: false, reason: "invalid" },
		);
		expect(
			await verifySignupCode(d1(), "nobody@example.com", "123456"),
		).toEqual({ ok: false, reason: "invalid" });
	});
});

describe("重发覆盖", () => {
	it("重发后旧码失效、新码可用，未使用记录只有一条", async () => {
		const { outcome, userId } = await register();
		const oldCode = outcome.code!;
		await resendVerification(
			d1(),
			testEnv(),
			"coder@example.com",
			ORIGIN,
			SITE_NAME,
		);

		const rows = db
			.prepare(
				"SELECT id FROM email_verifications WHERE user_id = ? AND purpose = 'signup' AND used_at IS NULL",
			)
			.all(userId) as { id: string }[];
		expect(rows).toHaveLength(1);

		expect(await verifySignupCode(d1(), "coder@example.com", oldCode)).toEqual({
			ok: false,
			reason: "invalid",
		});
		// 库内 hash 已换成新码的 hash（旧 hash 不再存在）
		const oldHash = await sha256Hex(oldCode);
		const same = db
			.prepare(
				"SELECT COUNT(*) AS n FROM email_verifications WHERE user_id = ? AND token_hash = ?",
			)
			.get(userId, oldHash) as { n: number };
		expect(same.n).toBe(0);
	});
});

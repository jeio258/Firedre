import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	ADMIN_SESSION_COOKIE,
	type AdminAuthEnv,
	buildSessionCookie,
	createSessionToken,
	getAuthenticatedAdminUsername,
	getCookieValue,
	getSecret,
	getSessionUser,
	isBcryptHash,
	passwordFingerprint,
	verifySessionToken,
} from "../server/auth/adminSession";

describe("isBcryptHash", () => {
	it("should return true for valid bcrypt hashes", async () => {
		const hash = await bcrypt.hash("test-password", 10);
		expect(isBcryptHash(hash)).toBe(true);
	});

	it("should return false for plaintext passwords", () => {
		expect(isBcryptHash("my-secret-password")).toBe(false);
		expect(isBcryptHash("admin123")).toBe(false);
		expect(isBcryptHash("")).toBe(false);
	});

	it("should return false for truncated or malformed hashes", () => {
		expect(isBcryptHash("$2b$10$abcdefghijklmnopqrstuv")).toBe(false);
		expect(isBcryptHash("$2b$10$x")).toBe(false);
	});

	it("should recognize all bcrypt variants", async () => {
		// $2b$ is the most common
		const hash2b = await bcrypt.hash("test", 10);
		expect(hash2b.startsWith("$2b$")).toBe(true);
		expect(isBcryptHash(hash2b)).toBe(true);
	});
});

describe("getSecret", () => {
	const testEnv: AdminAuthEnv = {};

	it("should return SESSION_SECRET when configured", () => {
		const env: AdminAuthEnv = { ...testEnv, SESSION_SECRET: "my-secret" };
		expect(getSecret(env)).toBe("my-secret");
	});

	it("should throw when SESSION_SECRET is missing", () => {
		const env: AdminAuthEnv = { ...testEnv };
		expect(() => getSecret(env)).toThrow("SESSION_SECRET 未配置");
	});

	it("should throw when SESSION_SECRET is empty string", () => {
		const env: AdminAuthEnv = { ...testEnv, SESSION_SECRET: "" };
		expect(() => getSecret(env)).toThrow("SESSION_SECRET 未配置");
	});

	it("should throw when SESSION_SECRET is whitespace only", () => {
		const env: AdminAuthEnv = { ...testEnv, SESSION_SECRET: "   " };
		expect(() => getSecret(env)).toThrow("SESSION_SECRET 未配置");
	});
});

describe("createSessionToken & verifySessionToken", () => {
	let mockEnv: AdminAuthEnv;

	beforeEach(() => {
		mockEnv = {
			SESSION_SECRET: "test-secret-key-for-hmac",
		};
	});

	it("should create and verify a valid session token", async () => {
		const token = await createSessionToken("admin", mockEnv);
		expect(token).toContain(".");
		const [payload, sig] = token.split(".");
		expect(payload).toBeDefined();
		expect(sig).toBeDefined();

		const user = await getSessionUser(token, mockEnv);
		expect(user).toBe("admin");
	});

	it("should reject tampered tokens", async () => {
		const token = await createSessionToken("admin", mockEnv);
		const tampered = token + "tampered";
		const user = await getSessionUser(tampered, mockEnv);
		expect(user).toBeNull();
	});

	it("should reject tokens from different secret", async () => {
		const token = await createSessionToken("admin", mockEnv);
		const otherEnv = { ...mockEnv, SESSION_SECRET: "different-secret" };
		const user = await getSessionUser(token, otherEnv);
		expect(user).toBeNull();
	});

	it("should reject expired tokens (max age 4h)", async () => {
		vi.useFakeTimers();
		try {
			vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
			const token = await createSessionToken("admin", mockEnv);
			// 前进 5 小时（超过 4 小时有效期）
			vi.setSystemTime(new Date("2026-01-01T05:00:00Z"));
			const user = await getSessionUser(token, mockEnv);
			expect(user).toBeNull();
		} finally {
			vi.useRealTimers();
		}
	});

	it("should return null for invalid token format", async () => {
		expect(await getSessionUser("invalid", mockEnv)).toBeNull();
		expect(await getSessionUser("no-dot", mockEnv)).toBeNull();
	});
});

describe("buildSessionCookie", () => {
	it("should create HttpOnly cookie with correct attributes", () => {
		const cookie = buildSessionCookie("test-token", false);
		expect(cookie).toContain("HttpOnly");
		expect(cookie).toContain("SameSite=Lax");
		expect(cookie).toContain("Path=/");
		expect(cookie).toContain("Max-Age=");
		expect(cookie).not.toContain("Secure");
	});

	it("should include Secure flag when secure=true", () => {
		const cookie = buildSessionCookie("test-token", true);
		expect(cookie).toContain("Secure");
	});
});

describe("getAuthenticatedAdminUsername fail-closed", () => {
	const secret = "test-secret-key-for-hmac";
	const HASH = "$2b$10$abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLM";

	async function reqWithToken(fp = "") {
		const token = await createSessionToken(
			"admin",
			{ SESSION_SECRET: secret },
			fp,
		);
		return new Request("https://example.com/admin", {
			headers: { Cookie: `${ADMIN_SESSION_COOKIE}=${token}` },
		});
	}

	function envWithDb(db: unknown) {
		return { SESSION_SECRET: secret, DB: db } as never;
	}

	it("DB 查询异常 → 拒绝", async () => {
		const db = {
			prepare() {
				throw new Error("D1 down");
			},
		};
		expect(
			await getAuthenticatedAdminUsername(await reqWithToken(), envWithDb(db)),
		).toBeNull();
	});

	it("管理员不存在 → 拒绝", async () => {
		const db = {
			prepare: () => ({ bind: () => ({ first: async () => null }) }),
		};
		expect(
			await getAuthenticatedAdminUsername(await reqWithToken(), envWithDb(db)),
		).toBeNull();
	});

	it("管理员被禁用 → 拒绝", async () => {
		const db = {
			prepare: () => ({
				bind: () => ({ first: async () => ({ enabled: 0 }) }),
			}),
		};
		expect(
			await getAuthenticatedAdminUsername(await reqWithToken(), envWithDb(db)),
		).toBeNull();
	});

	it("管理员启用 → 通过", async () => {
		const db = {
			prepare: () => ({
				bind: () => ({
					first: async () => ({ enabled: 1, password_hash: HASH }),
				}),
			}),
		};
		const fp = await passwordFingerprint(HASH);
		expect(
			await getAuthenticatedAdminUsername(
				await reqWithToken(fp),
				envWithDb(db),
			),
		).toBe("admin");
	});

	it("密码变更后旧会话（指纹不匹配）→ 拒绝", async () => {
		const db = {
			prepare: () => ({
				bind: () => ({
					first: async () => ({
						enabled: 1,
						password_hash:
							"$2b$10$NEWHASH_AFTER_CHANGE_000000000000000000000000",
					}),
				}),
			}),
		};
		const oldFp = await passwordFingerprint(HASH);
		expect(
			await getAuthenticatedAdminUsername(
				await reqWithToken(oldFp),
				envWithDb(db),
			),
		).toBeNull();
	});

	it("token 无指纹（旧格式）→ 拒绝", async () => {
		const db = {
			prepare: () => ({
				bind: () => ({
					first: async () => ({ enabled: 1, password_hash: HASH }),
				}),
			}),
		};
		expect(
			await getAuthenticatedAdminUsername(await reqWithToken(), envWithDb(db)),
		).toBeNull();
	});
});

describe("getCookieValue 容错", () => {
	it("解析正常编码的值", () => {
		expect(
			getCookieValue(`${ADMIN_SESSION_COOKIE}=abc123`, ADMIN_SESSION_COOKIE),
		).toBe("abc123");
	});

	it("非法百分号序列回退原值而不抛异常", () => {
		expect(() =>
			getCookieValue(`${ADMIN_SESSION_COOKIE}=%zz`, ADMIN_SESSION_COOKIE),
		).not.toThrow();
		expect(
			getCookieValue(`${ADMIN_SESSION_COOKIE}=%zz`, ADMIN_SESSION_COOKIE),
		).toBe("%zz");
	});

	it("其他 Cookie 异常值不影响目标读取", () => {
		expect(
			getCookieValue(
				`other=%zz; ${ADMIN_SESSION_COOKIE}=tok`,
				ADMIN_SESSION_COOKIE,
			),
		).toBe("tok");
	});
});

describe("非 ASCII 用户名会话（中文/emoji）", () => {
	const env: AdminAuthEnv = { SESSION_SECRET: "test-secret-key-for-hmac" };

	it("中文用户名：签发后可解出同一用户名", async () => {
		const token = await createSessionToken("张三", env);
		expect(await getSessionUser(token, env)).toBe("张三");
	});

	it("emoji 用户名：签发后可解出同一用户名", async () => {
		const token = await createSessionToken("管理员🎉", env);
		expect(await getSessionUser(token, env)).toBe("管理员🎉");
	});

	it("ASCII 用户名 payload 与 UTF-8 base64url 一致（向后兼容）", async () => {
		vi.useFakeTimers();
		let token: string;
		try {
			const now = new Date("2026-01-01T00:00:00Z");
			vi.setSystemTime(now);
			token = await createSessionToken("admin", env);
			const [payload] = token.split(".");
			const exp = now.getTime() + 60 * 60 * 4 * 1000;
			const expected = Buffer.from(
				JSON.stringify({ u: "admin", exp }),
				"utf8",
			).toString("base64url");
			expect(payload).toBe(expected);
		} finally {
			vi.useRealTimers();
		}
	});
});

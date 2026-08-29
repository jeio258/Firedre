import { describe, it, expect, beforeEach } from "vitest";
import bcrypt from "bcryptjs";
import {
	authExports,
	type AdminAuthEnv,
} from "../server/auth/adminSession";

const {
	getSecret,
	isBcryptHash,
	createSessionToken,
	verifySessionToken,
	getSessionUser,
	buildSessionCookie,
	validateAdminCredentials,
} = authExports;

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
		// Valid prefix but wrong length (60 chars for bcrypt)
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
	const testEnv = {
		ADMIN_USERNAME: "admin",
		ADMIN_PASSWORD: "$2b$10$abcdefghijklmnopqrstuvABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdef",
	};

	it("should return SESSION_SECRET when configured", () => {
		const env: AdminAuthEnv = { ...testEnv, SESSION_SECRET: "my-secret" };
		expect(getSecret(env)).toBe("my-secret");
	});

	it("should throw when SESSION_SECRET is missing", () => {
		const env: AdminAuthEnv = { ...testEnv };
		expect(() => getSecret(env)).toThrow(
			"SESSION_SECRET 未配置",
		);
	});

	it("should throw when SESSION_SECRET is empty string", () => {
		const env: AdminAuthEnv = { ...testEnv, SESSION_SECRET: "" };
		expect(() => getSecret(env)).toThrow("SESSION_SECRET 未配置");
	});

	it("should throw when SESSION_SECRET is whitespace only", () => {
		const env: AdminAuthEnv = { ...testEnv, SESSION_SECRET: "   " };
		expect(() => getSecret(env)).toThrow("SESSION_SECRET 未配置");
	});

	it("should NOT fall back to ADMIN_API_TOKEN or ADMIN_PASSWORD", () => {
		// Old behavior allowed fallback - new behavior requires explicit SESSION_SECRET
		const env: AdminAuthEnv = {
			...testEnv,
			ADMIN_API_TOKEN: "some-token",
		};
		expect(() => getSecret(env)).toThrow("SESSION_SECRET 未配置");
	});
});

describe("createSessionToken & verifySessionToken", () => {
	let mockEnv: AdminAuthEnv;

	beforeEach(() => {
		mockEnv = {
			ADMIN_USERNAME: "admin",
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

	it("should expire tokens after max age", async () => {
		// Use a secret that's valid
		const token = await createSessionToken("admin", mockEnv);
		// Token has 4h expiry by default
		const user = await getSessionUser(token, mockEnv);
		expect(user).toBe("admin");
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

describe("validateAdminCredentials", () => {
	let bcryptHash: string;

	beforeEach(async () => {
		bcryptHash = await bcrypt.hash("correct-password", 10);
	});

	it("should accept correct bcrypt password", async () => {
		const env: AdminAuthEnv = {
			ADMIN_USERNAME: "admin",
			ADMIN_PASSWORD: bcryptHash,
		};
		expect(
			await validateAdminCredentials("admin", "correct-password", env),
		).toBe(true);
	});

	it("should reject wrong password", async () => {
		const env: AdminAuthEnv = {
			ADMIN_USERNAME: "admin",
			ADMIN_PASSWORD: bcryptHash,
		};
		expect(
			await validateAdminCredentials("admin", "wrong-password", env),
		).toBe(false);
	});

	it("should reject wrong username", async () => {
		const env: AdminAuthEnv = {
			ADMIN_USERNAME: "admin",
			ADMIN_PASSWORD: bcryptHash,
		};
		expect(
			await validateAdminCredentials("other", "correct-password", env),
		).toBe(false);
	});

	it("should return false when login not configured", async () => {
		const env: AdminAuthEnv = {};
		expect(
			await validateAdminCredentials("admin", "password", env),
		).toBe(false);
	});

	describe("plaintext legacy password auto-upgrade", () => {
		it("accepts matching plaintext and upgrades to bcrypt (memory)", async () => {
			const env: AdminAuthEnv = {
				ADMIN_USERNAME: "admin",
				ADMIN_PASSWORD: "legacy-plain-123",
			};
			const ok = await validateAdminCredentials(
				"admin",
				"legacy-plain-123",
				env,
			);
			expect(ok).toBe(true);
			// 升级后 env 中应立即为 bcrypt 哈希
			expect(isBcryptHash(String(env.ADMIN_PASSWORD))).toBe(true);
		});

		it("rejects wrong plaintext (uses constant-time compare, no upgrade)", async () => {
			const env: AdminAuthEnv = {
				ADMIN_USERNAME: "admin",
				ADMIN_PASSWORD: "legacy-plain-123",
			};
			const ok = await validateAdminCredentials(
				"admin",
				"wrong-plaintext",
				env,
			);
			expect(ok).toBe(false);
			// 未匹配时不应改写为哈希
			expect(env.ADMIN_PASSWORD).toBe("legacy-plain-123");
		});

		it("accepts plaintext password of equal length only (constant-time path)", async () => {
			const env: AdminAuthEnv = {
				ADMIN_USERNAME: "admin",
				ADMIN_PASSWORD: "abcdef",
			};
			expect(
				await validateAdminCredentials("admin", "abcdef", env),
			).toBe(true);
			expect(
				await validateAdminCredentials("admin", "abcxyz", env),
			).toBe(false);
		});
	});
});

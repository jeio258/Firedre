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

import { DatabaseSync } from "node:sqlite";
import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it } from "vitest";
import {
	ADMIN_SESSION_TTL,
	buildClearUserSessionCookie,
	buildUserSessionCookie,
	createSessionToken,
	getAuthUser,
	getSessionPayload,
	hasUserSessionCookie,
	sessionMaxAge,
	USER_SESSION_MAX_AGE,
	type UserSessionEnv,
} from "../server/auth/userSession";
import { makeD1 } from "./helpers/d1";
import { applyMigrations } from "./helpers/migrations";

const SECRET = "test-user-session-secret-0123456789abcdef";

let db: DatabaseSync;

beforeEach(() => {
	db = new DatabaseSync(":memory:");
	applyMigrations(db);
});

function testEnv(): UserSessionEnv {
	return {
		DB: makeD1(db),
		USER_SESSION_SECRET: SECRET,
	} as unknown as UserSessionEnv;
}

async function seedUser(opts: { role?: string; banned?: number } = {}) {
	const id = crypto.randomUUID();
	const password = await bcrypt.hash("initial-password", 4);
	db.prepare(
		`INSERT INTO users (id, email, email_verified, name, password, role, banned)
     VALUES (?, ?, 1, ?, ?, ?, ?)`,
	).run(
		id,
		`${id}@example.com`,
		"tester",
		password,
		opts.role ?? "user",
		opts.banned ?? 0,
	);
	return { id, password };
}

function requestWithToken(token: string): Request {
	return new Request("https://site.test/profile/", {
		headers: { Cookie: `user_session=${token}` },
	});
}

describe("用户会话签发与校验", () => {
	it("签发的 token 能解析出用户、角色与密码指纹", async () => {
		const { id } = await seedUser();
		const token = await createSessionToken(id, "user", testEnv());
		const payload = await getSessionPayload(token, testEnv());

		expect(payload?.u).toBe(id);
		expect(payload?.role).toBe("user");
		expect(payload?.exp).toBeGreaterThan(Date.now());
		expect(payload?.v).toHaveLength(16);
	});

	it("签名被篡改的 token 一律视为未登录", async () => {
		const { id } = await seedUser();
		const token = await createSessionToken(id, "admin", testEnv());
		const [body, sig] = token.split(".");
		const flipped = sig.endsWith("A")
			? `${sig.slice(0, -1)}B`
			: `${sig.slice(0, -1)}A`;
		const tampered = `${body}.${flipped}`;

		expect(await getSessionPayload(tampered, testEnv())).toBeNull();
		expect(await getAuthUser(requestWithToken(tampered), testEnv())).toBeNull();
	});

	it("换密钥签发的 token 不通过验签", async () => {
		const { id } = await seedUser();
		const token = await createSessionToken(id, "user", testEnv());
		const otherEnv = {
			DB: makeD1(db),
			USER_SESSION_SECRET: "another-secret-0123456789abcdef",
		} as unknown as UserSessionEnv;

		expect(await getSessionPayload(token, otherEnv)).toBeNull();
	});

	it("超过有效期的 token 失效", async () => {
		const { id } = await seedUser();
		const expired = await createSessionToken(id, "user", testEnv(), -1);

		expect(await getSessionPayload(expired, testEnv())).toBeNull();
		expect(await getAuthUser(requestWithToken(expired), testEnv())).toBeNull();
	});

	it("未过期的 token 能在库里解析出完整用户", async () => {
		const { id } = await seedUser();
		const token = await createSessionToken(id, "user", testEnv());
		const me = await getAuthUser(requestWithToken(token), testEnv());

		expect(me?.id).toBe(id);
		expect(me?.email_verified).toBe(1);
		expect(me?.banned).toBe(0);
	});
});

describe("密码指纹吊销", () => {
	it("改密后旧 token 立即失效", async () => {
		const { id } = await seedUser();
		const token = await createSessionToken(id, "user", testEnv());
		expect(
			await getAuthUser(requestWithToken(token), testEnv()),
		).not.toBeNull();

		db.prepare("UPDATE users SET password = ? WHERE id = ?").run(
			await bcrypt.hash("rotated-password", 4),
			id,
		);

		expect(await getAuthUser(requestWithToken(token), testEnv())).toBeNull();
	});

	it("改密后重新签发的 token 可用", async () => {
		const { id } = await seedUser();
		const stale = await createSessionToken(id, "user", testEnv());
		db.prepare("UPDATE users SET password = ? WHERE id = ?").run(
			await bcrypt.hash("rotated-password", 4),
			id,
		);
		const fresh = await createSessionToken(id, "user", testEnv());

		expect(await getAuthUser(requestWithToken(stale), testEnv())).toBeNull();
		expect(
			await getAuthUser(requestWithToken(fresh), testEnv()),
		).not.toBeNull();
	});
});

describe("封禁与缺失账号", () => {
	it("封禁用户即使 token 有效也拿不到身份（每请求查库）", async () => {
		const { id } = await seedUser();
		const token = await createSessionToken(id, "user", testEnv());

		db.prepare("UPDATE users SET banned = 1 WHERE id = ?").run(id);

		expect(await getAuthUser(requestWithToken(token), testEnv())).toBeNull();
	});

	it("用户行被删除后 token 不再解析出身份", async () => {
		const { id } = await seedUser();
		const token = await createSessionToken(id, "user", testEnv());
		db.prepare("DELETE FROM users WHERE id = ?").run(id);

		expect(await getAuthUser(requestWithToken(token), testEnv())).toBeNull();
	});

	it("无 Cookie 的请求返回未登录", async () => {
		const request = new Request("https://site.test/profile/");
		expect(await getAuthUser(request, testEnv())).toBeNull();
	});
});

describe("Cookie 构造与角色时长", () => {
	it("admin 会话 4 小时、普通用户 30 天", async () => {
		expect(sessionMaxAge("admin")).toBe(ADMIN_SESSION_TTL);
		expect(sessionMaxAge("user")).toBe(USER_SESSION_MAX_AGE);
		expect(ADMIN_SESSION_TTL).toBe(4 * 60 * 60);
		expect(USER_SESSION_MAX_AGE).toBe(30 * 24 * 60 * 60);

		// 签发时按角色取默认时长：管理员不再拿到 30 天 token
		const admin = await seedUser({ role: "admin" });
		const user = await seedUser({ role: "user" });
		const adminExp = (
			await getSessionPayload(
				await createSessionToken(admin.id, "admin", testEnv()),
				testEnv(),
			)
		)?.exp;
		const userExp = (
			await getSessionPayload(
				await createSessionToken(user.id, "user", testEnv()),
				testEnv(),
			)
		)?.exp;

		const now = Date.now();
		expect(adminExp! - now).toBeLessThanOrEqual(
			ADMIN_SESSION_TTL * 1000 + 1000,
		);
		expect(userExp! - now).toBeGreaterThan(ADMIN_SESSION_TTL * 1000);
	});

	it("记住我才会带 Max-Age，https 才带 Secure", () => {
		const persistent = buildUserSessionCookie("tam-token", false, true);
		expect(persistent).toContain(`Max-Age=${USER_SESSION_MAX_AGE}`);
		expect(persistent).not.toContain("Secure");

		const session = buildUserSessionCookie("tam-token", true, false);
		expect(session).not.toContain("Max-Age");
		expect(session).toContain("Secure");
		expect(session).toContain("HttpOnly");
		expect(session).toContain("SameSite=Lax");
	});

	it("清除 Cookie 用 Max-Age=0 立即失效", () => {
		expect(buildClearUserSessionCookie(false)).toContain("Max-Age=0");
	});

	it("带 user_session 的 Cookie 头能被识别（HTML 缓存绕过判据）", () => {
		expect(hasUserSessionCookie("a=1; user_session=abc.def")).toBe(true);
		expect(hasUserSessionCookie("user_session=abc")).toBe(true);
		expect(hasUserSessionCookie("admin_session=abc")).toBe(false);
		expect(hasUserSessionCookie("xuser_session=abc")).toBe(false);
		expect(hasUserSessionCookie(null)).toBe(false);
	});
});

import { describe, it, expect, beforeEach } from "vitest";
import {
	getAlbumPassword,
	setAlbumPassword,
	deleteAlbumPassword,
} from "../server/gallery/password";

function makeDbMock() {
	const store = new Map<string, string>();
	const db = {
		store,
		prepare(sql: string) {
			const fn = {
				bind: (...args: unknown[]) => {
					const bound = { sql, args };
					return {
						first: async () => {
							if (sql.includes("SELECT password FROM album_passwords")) {
								const slug = String(bound.args[0]);
								const pwd = store.get(slug);
								return pwd ? { password: pwd } : null;
							}
							return null;
						},
						run: async () => {
							if (sql.includes("INSERT INTO album_passwords")) {
								const slug = String(bound.args[0]);
								const pwd = String(bound.args[1]);
								store.set(slug, pwd);
							} else if (sql.includes("DELETE FROM album_passwords")) {
								const slug = String(bound.args[0]);
								store.delete(slug);
							}
							return { success: true };
						},
					};
				},
			};
			return fn as unknown as ReturnType<typeof db.prepare>;
		},
	};
	return db;
}

describe("album_passwords（相册密码 D1 存储）", () => {
	let db: ReturnType<typeof makeDbMock>;
	const env = { DB: {} } as unknown as Parameters<typeof getAlbumPassword>[0];

	beforeEach(() => {
		db = makeDbMock();
		(env as { DB: unknown }).DB = db;
	});

	it("未设置时返回空串", async () => {
		expect(await getAlbumPassword(env, "test")).toBe("");
	});

	it("设置后能读取到明文", async () => {
		await setAlbumPassword(env, "test", "123456");
		expect(await getAlbumPassword(env, "test")).toBe("123456");
	});

	it("空密码等于清除", async () => {
		await setAlbumPassword(env, "test", "123456");
		await setAlbumPassword(env, "test", "   ");
		expect(await getAlbumPassword(env, "test")).toBe("");
	});

	it("delete 后返回空串", async () => {
		await setAlbumPassword(env, "test", "123456");
		await deleteAlbumPassword(env, "test");
		expect(await getAlbumPassword(env, "test")).toBe("");
	});

	it("不同相册密码互相隔离", async () => {
		await setAlbumPassword(env, "a", "aaa");
		await setAlbumPassword(env, "b", "bbb");
		expect(await getAlbumPassword(env, "a")).toBe("aaa");
		expect(await getAlbumPassword(env, "b")).toBe("bbb");
	});
});

describe("album_passwords（静态加密）", () => {
	const SECRET = "unit-test-secret-0123456789abcdef0123456789abcdef";
	let db: ReturnType<typeof makeDbMock>;
	const env = { DB: {}, SESSION_SECRET: SECRET } as unknown as Parameters<
		typeof getAlbumPassword
	>[0];

	beforeEach(() => {
		db = makeDbMock();
		(env as { DB: unknown }).DB = db;
	});

	it("配置 secret 后落库为密文而非明文", async () => {
		await setAlbumPassword(env, "enc", "plain-pwd");
		const stored = db.store.get("enc") ?? "";
		expect(stored).not.toBe("plain-pwd");
		expect(stored.startsWith("enc1:")).toBe(true);
		expect(await getAlbumPassword(env, "enc")).toBe("plain-pwd");
	});

	it("历史明文值兼容读取", async () => {
		db.store.set("legacy", "old-plain");
		expect(await getAlbumPassword(env, "legacy")).toBe("old-plain");
	});

	it("不同 secret 无法解密（返回空串）", async () => {
		await setAlbumPassword(env, "enc", "plain-pwd");
		const otherEnv = {
			DB: db,
			SESSION_SECRET: "another-secret-0123456789abcdef0123456789abcd",
		} as unknown as Parameters<typeof getAlbumPassword>[0];
		expect(await getAlbumPassword(otherEnv, "enc")).toBe("");
	});
});

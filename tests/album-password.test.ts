import { describe, it, expect, beforeEach } from "vitest";
import {
	getAlbumPassword,
	setAlbumPassword,
	deleteAlbumPassword,
} from "../server/gallery/password";

/**
 * 极简 in-memory D1 mock（仅覆盖 album_passwords 表用到的 prepare/bind/first/run）。
 */
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

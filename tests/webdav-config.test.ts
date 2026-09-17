import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { DatabaseSync } from "node:sqlite";
import {
	getAlbumWebDavConfig,
	setAlbumWebDavConfig,
	deleteAlbumWebDavConfig,
} from "../server/gallery/webdavConfig";
import { makeD1 } from "./helpers/d1";
import { applyMigrations } from "./helpers/migrations";

let db: DatabaseSync;

beforeAll(() => {
	db = new DatabaseSync(":memory:");
	applyMigrations(db);
});

const env = () => ({ DB: makeD1(db) });

describe("album_webdav 表", () => {
	beforeEach(() => {
		db.exec("DELETE FROM album_webdav");
	});

	it("迁移后 album_webdav 表存在", () => {
		const row = db
			.prepare(
				"SELECT name FROM sqlite_master WHERE type='table' AND name='album_webdav'",
			)
			.get() as { name: string } | undefined;
		expect(row?.name).toBe("album_webdav");
	});

	it("setAlbumWebDavConfig 写入后可读取", async () => {
		await setAlbumWebDavConfig(
			env() as never,
			"album-a",
			"https://dav.example.com/files/user/a",
			"user-a",
		);
		const config = await getAlbumWebDavConfig(env() as never, "album-a");
		expect(config).toEqual({
			url: "https://dav.example.com/files/user/a",
			username: "user-a",
		});
	});

	it("setAlbumWebDavConfig 不带 username 时返回 undefined", async () => {
		await setAlbumWebDavConfig(env() as never, "album-b", "https://dav.example.com/b");
		const config = await getAlbumWebDavConfig(env() as never, "album-b");
		expect(config).toEqual({ url: "https://dav.example.com/b" });
		expect(config?.username).toBeUndefined();
	});

	it("setAlbumWebDavConfig 覆盖更新（upsert）", async () => {
		await setAlbumWebDavConfig(env() as never, "album-c", "https://old.example.com", "old");
		await setAlbumWebDavConfig(env() as never, "album-c", "https://new.example.com", "new");
		const config = await getAlbumWebDavConfig(env() as never, "album-c");
		expect(config).toEqual({
			url: "https://new.example.com",
			username: "new",
		});
	});

	it("空 url 视为清除（set 传空字符串删除记录）", async () => {
		await setAlbumWebDavConfig(env() as never, "album-d", "https://x.example.com");
		await setAlbumWebDavConfig(env() as never, "album-d", "");
		expect(await getAlbumWebDavConfig(env() as never, "album-d")).toBeNull();
	});

	it("deleteAlbumWebDavConfig 删除记录", async () => {
		await setAlbumWebDavConfig(env() as never, "album-e", "https://x.example.com");
		await deleteAlbumWebDavConfig(env() as never, "album-e");
		expect(await getAlbumWebDavConfig(env() as never, "album-e")).toBeNull();
	});

	it("不存在的相册返回 null", async () => {
		expect(await getAlbumWebDavConfig(env() as never, "nope")).toBeNull();
	});
});

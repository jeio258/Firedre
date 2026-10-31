import { DatabaseSync } from "node:sqlite";
import { beforeAll, describe, expect, it } from "vitest";
import {
	getAlbumFromD1,
	getAlbumsFromD1Map,
	upsertAlbumToD1,
} from "../server/gallery/d1";
import { setAlbumPassword } from "../server/gallery/password";
import { makeD1 } from "./helpers/d1";
import { applyMigrations } from "./helpers/migrations";

let db: DatabaseSync;
let env: { DB: D1Like; SESSION_SECRET: string };

beforeAll(() => {
	db = new DatabaseSync(":memory:");
	db.exec("PRAGMA foreign_keys = ON");
	applyMigrations(db);
	env = {
		DB: makeD1(db),
		SESSION_SECRET: "unit-test-secret-0123456789abcdef0123456789abcdef",
	};
});

const fm = (password?: string) => ({
	title: "相册",
	encrypted: Boolean(password),
	source: "local" as const,
	...(password ? { password } : {}),
});

describe("相册口令不再明文落 password_hint", () => {
	it("upsert 时 password_hint 恒为 NULL（口令走加密表）", async () => {
		await setAlbumPassword(env, "sec-a", "1234");
		await upsertAlbumToD1(env, "sec-a", fm("1234"), "content");

		const row = db
			.prepare("SELECT password_hint FROM albums WHERE slug = ?")
			.get("sec-a") as { password_hint: string | null };
		expect(row.password_hint).toBeNull();
	});

	it("getAlbumFromD1 从加密表解密回填口令（编辑回显）", async () => {
		await setAlbumPassword(env, "sec-b", "abcd");
		await upsertAlbumToD1(env, "sec-b", fm("abcd"), "content");

		const detail = await getAlbumFromD1(env, "sec-b");
		expect(detail?.frontmatter.password).toBe("abcd");
	});

	it("getAlbumsFromD1Map 批量解密回填", async () => {
		await setAlbumPassword(env, "sec-c", "efgh");
		await upsertAlbumToD1(env, "sec-c", fm("efgh"), "content");

		const map = await getAlbumsFromD1Map(env, ["sec-c"]);
		expect(map.get("sec-c")?.frontmatter.password).toBe("efgh");
	});

	it("无口令相册不回填 password", async () => {
		await upsertAlbumToD1(env, "open-a", fm(), "content");
		const detail = await getAlbumFromD1(env, "open-a");
		expect(detail?.frontmatter.password).toBeUndefined();
	});
});

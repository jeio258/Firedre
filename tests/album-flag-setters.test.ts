import { describe, it, expect, beforeAll } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { getAlbumFromD1, upsertAlbumToD1 } from "../server/gallery/d1";
import {
	setAlbumEncryptedFlag,
	setAlbumSourceFlag,
} from "../server/gallery/service";
import { makeD1 } from "./helpers/d1";
import { applyMigrations } from "./helpers/migrations";
import { makeR2 } from "./helpers/r2";

const R2_SOURCE =
	"---\nlayout: gallery-album\ntitle: R2 相册\nsource: local\nencrypted: false\nphotos:\n  - url: /api/gallery-files/r2-album/files/1.jpg\n---\nR2 正文";

let db: DatabaseSync;
let env: { DB: unknown; BUCKET: unknown };

beforeAll(() => {
	db = new DatabaseSync(":memory:");
	db.exec("PRAGMA foreign_keys = ON");
	applyMigrations(db, ["0006_album_webdav.sql", "0007_albums.sql"]);
	env = {
		DB: makeD1(db),
		BUCKET: makeR2({ "gallery/r2-album/index.md": R2_SOURCE }),
	} as unknown as Parameters<typeof setAlbumEncryptedFlag>[0];
});

describe("setAlbumEncryptedFlag / setAlbumSourceFlag 回写（回归：原恒 no-op 缺陷）", () => {
	it("D1 相册：encrypted 翻转回写 D1 且保留照片与正文", async () => {
		await upsertAlbumToD1(
			env as never,
			"d1-album",
			{
				title: "D1 相册",
				source: "local",
				encrypted: false,
				photos: [{ url: "/p/1.jpg" }],
			},
			"D1 正文",
		);

		await setAlbumEncryptedFlag(env as never, "d1-album", true);
		let d1 = await getAlbumFromD1(env as never, "d1-album");
		expect(d1?.frontmatter.encrypted).toBe(true);

		await setAlbumEncryptedFlag(env as never, "d1-album", false);
		d1 = await getAlbumFromD1(env as never, "d1-album");
		expect(d1?.frontmatter.encrypted).toBe(false);
		expect(d1?.frontmatter.photos?.length).toBe(1);
		expect(d1?.content).toBe("D1 正文");
	});

	it("D1 相册：source 切换 webdav 后回写 D1", async () => {
		await setAlbumSourceFlag(env as never, "d1-album", "webdav");
		const d1 = await getAlbumFromD1(env as never, "d1-album");
		expect(d1?.frontmatter.source).toBe("webdav");
	});

	it("仅 R2 存量相册：encrypted 翻转写入 R2 且保留正文", async () => {
		await setAlbumEncryptedFlag(env as never, "r2-album", true);
		const stored = (
			env as { BUCKET: { store: Map<string, string> } }
		).BUCKET.store.get("gallery/r2-album/index.md");
		expect(stored).toContain("encrypted: true");
		expect(stored).toContain("R2 正文");
	});

	it("仅 R2 存量相册：source 切换写入 R2", async () => {
		await setAlbumSourceFlag(env as never, "r2-album", "webdav");
		const stored = (
			env as { BUCKET: { store: Map<string, string> } }
		).BUCKET.store.get("gallery/r2-album/index.md");
		expect(stored).toContain('source: "webdav"');
	});
});

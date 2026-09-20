import { createServer, type Server } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { handleAlbumWebdavHttp } from "../server/gallery/albumWebdavHttp";
import { upsertAlbumToD1 } from "../server/gallery/d1";
import { setAlbumPassword } from "../server/gallery/password";
import { setAlbumWebDavConfig } from "../server/gallery/webdavConfig";
import { makeD1 } from "./helpers/d1";
import { applyMigrations } from "./helpers/migrations";
import { makeR2 } from "./helpers/r2";

// 真环境回归：真 node:sqlite D1 + 真 R2 桩 + 真 WebDAV HTTP 桩 + 真调用链，
// 不 mock 被测逻辑；哨兵由真 decryptPassword 触发（密钥轮换），非手工伪造返回值。
const OK_SLUG = "dav-ok";
const BROKEN_SLUG = "dav-broken";
const ALBUM_PASSWORD = "correct-secret";
const LIVE_SECRET = "l".repeat(40);
const ROTATED_SECRET = "r".repeat(40);
const DAV_PATH = "/files/user/a";

const PROPFIND_XML = `<?xml version="1.0" encoding="utf-8"?>
<d:multistatus xmlns:d="DAV:">
  <d:response><d:href>${DAV_PATH}/</d:href></d:response>
  <d:response>
    <d:href>${DAV_PATH}/photo1.jpg</d:href>
    <d:getlastmodified>Wed, 01 Jan 2025 00:00:00 GMT</d:getlastmodified>
    <d:getcontenttype>image/jpeg</d:getcontenttype>
  </d:response>
</d:multistatus>`;

let db: DatabaseSync;
let davServer: Server;
let env: Record<string, unknown>;

beforeAll(async () => {
	db = new DatabaseSync(":memory:");
	db.exec("PRAGMA foreign_keys = ON");
	applyMigrations(db);

	davServer = createServer((_req, res) => {
		res.statusCode = 207;
		res.setHeader("Content-Type", "application/xml; charset=utf-8");
		res.end(PROPFIND_XML);
	});
	await new Promise<void>((resolve) => {
		davServer.listen(0, "127.0.0.1", resolve);
	});
	const address = davServer.address();
	if (!address || typeof address === "string")
		throw new Error("WebDAV 桩启动失败");

	env = {
		DB: makeD1(db),
		BUCKET: makeR2({}),
		SESSION_SECRET: LIVE_SECRET,
		WEBDAV_PASSWORD: "upstream-password",
	};

	const davUrl = `http://127.0.0.1:${address.port}${DAV_PATH}`;
	for (const slug of [OK_SLUG, BROKEN_SLUG]) {
		await upsertAlbumToD1(
			env as never,
			slug,
			{
				title: "加密 WebDAV 相册",
				source: "webdav",
				encrypted: true,
				photos: [],
			},
			"正文",
		);
		await setAlbumWebDavConfig(env as never, slug, davUrl, "user");
	}

	// 正常相册：当前密钥加密，可解密
	await setAlbumPassword(env as never, OK_SLUG, ALBUM_PASSWORD);

	// 异常相册：用另一把密钥加密（模拟 SESSION_SECRET 轮换）→ 当前密钥解密失败 → 哨兵
	await setAlbumPassword(
		{ ...env, SESSION_SECRET: ROTATED_SECRET } as never,
		BROKEN_SLUG,
		ALBUM_PASSWORD,
	);
});

afterAll(async () => {
	await new Promise<void>((resolve) => {
		davServer.close(() => resolve());
	});
});

function requestAlbumList(slug: string, accessPassword?: string) {
	const url = new URL("https://site.test/api/album-webdav/list");
	url.searchParams.set("slug", slug);
	if (accessPassword !== undefined) {
		url.searchParams.set("accessPassword", accessPassword);
	}
	return handleAlbumWebdavHttp(new Request(url, { method: "GET" }), {
		env: env as never,
	});
}

describe("WebDAV 相册口令解密失败必须 fail-closed", () => {
	it("哨兵（密钥轮换致解密失败）→ 403，且未走到放行分支", async () => {
		// WebDAV 桩可用：若走放行分支会拿到 200 + 照片列表（即口令保护被绕过）
		const res = await requestAlbumList(BROKEN_SLUG);
		const body = (await res.json()) as { message?: string; photos?: unknown };

		expect(res.status).toBe(403);
		expect(body.photos).toBeUndefined();
		expect(body.message).toContain("口令校验不可用");
	});

	it("口令可解密但 accessPassword 错误 → 403", async () => {
		const res = await requestAlbumList(OK_SLUG, "wrong-secret");
		const body = (await res.json()) as { message?: string; photos?: unknown };

		expect(res.status).toBe(403);
		expect(body.photos).toBeUndefined();
		expect(body.message).toContain("需要正确的相册访问密码");
	});

	it("口令可解密且 accessPassword 正确 → 200 并返回照片（未被误拦）", async () => {
		const res = await requestAlbumList(OK_SLUG, ALBUM_PASSWORD);
		const body = (await res.json()) as {
			photos?: Array<{ url: string; type?: string }>;
		};

		expect(res.status).toBe(200);
		expect(body.photos).toHaveLength(1);
		expect(body.photos?.[0]?.url).toContain("photo1.jpg");
		expect(body.photos?.[0]?.type).toBe("image");
	});
});

import { describe, it, expect, beforeEach } from "vitest";
import { unlockGalleryAlbum, upsertGalleryAlbum } from "../server/gallery/service";

function makeBucketMock(sourceBySlug: Record<string, string>) {
	return {
		get: async (key: string) => {
			const match = key.match(/^gallery\/([^/]+)\/index\.md$/);
			if (!match) return null;
			const source = sourceBySlug[match[1]];
			return source ? { text: async () => source } : null;
		},
		put: async (_key: string, source: string) => {
			const match = _key.match(/^gallery\/([^/]+)\/index\.md$/);
			if (match) sourceBySlug[match[1]] = source;
		},
	};
}

function makeDbMock(passwords: Record<string, string>) {
	return {
		prepare(sql: string) {
			const fn = {
				bind: (...args: unknown[]) => {
					const bound = { sql, args };
					return {
						first: async () => {
							if (sql.includes("SELECT password FROM album_passwords")) {
								const slug = String(bound.args[0]);
								return passwords[slug]
									? { password: passwords[slug] }
									: null;
							}
							return null;
						},
						run: async () => {

							if (sql.includes("INSERT INTO album_passwords")) {
								const slug = String(bound.args[0]);
								const pwd = String(bound.args[1]);
								passwords[slug] = pwd;
							} else if (sql.includes("DELETE FROM album_passwords")) {
								const slug = String(bound.args[0]);
								delete passwords[slug];
							}
							return { success: true };
						},
					};
				},
			};
			return fn;
		},
	};
}

function buildEnv(sourceBySlug: Record<string, string>, passwords: Record<string, string>) {
	return {
		BUCKET: makeBucketMock(sourceBySlug),
		DB: makeDbMock(passwords),
	} as unknown as Parameters<typeof unlockGalleryAlbum>[0];
}

const UNENCRYPTED_ALBUM =
	"---\nlayout: gallery-album\ntitle: Test\nalbums: []\nencrypted: false\nphotos:\n  - url: /api/gallery-files/a/files/1.jpg\n---\n";
const ENCRYPTED_ALBUM =
	"---\nlayout: gallery-album\ntitle: Test\nencrypted: true\nphotos:\n  - url: /api/gallery-files/b/files/1.jpg\n---\n";

const EDIT_WITHOUT_PASSWORD =
	"---\nlayout: gallery-album\ntitle: 改名\nencrypted: true\nphotos:\n  - url: /api/gallery-files/a/files/1.jpg\n---\n新内容\n";
const EDIT_WITH_PASSWORD =
	"---\nlayout: gallery-album\ntitle: 改名\npassword: newpass\nphotos:\n  - url: /api/gallery-files/a/files/1.jpg\n---\n";

describe("upsertGalleryAlbum 不应清除 D1 相册密码（P1 回归）", () => {
	it("通用编辑（markdown 不含 password 字段）不删除已设的 D1 密码", async () => {
		const passwords: Record<string, string> = { a: "secret123" };
		const env = buildEnv({ a: UNENCRYPTED_ALBUM }, passwords);
		await upsertGalleryAlbum(env, "a", EDIT_WITHOUT_PASSWORD);
		// 密码框设的密码必须保留，否则普通编辑后加密相册变公开
		expect(passwords["a"]).toBe("secret123");
	});

	it("通用编辑（markdown 不含 password）不向无密码相册写入密码", async () => {
		const passwords: Record<string, string> = {};
		const env = buildEnv({ a: UNENCRYPTED_ALBUM }, passwords);
		await upsertGalleryAlbum(env, "a", EDIT_WITHOUT_PASSWORD);
		expect(passwords["a"]).toBeUndefined();
	});

	it("markdown 显式含 password 时（旧手写相册兼容）仍同步到 D1 并带锁", async () => {
		const passwords: Record<string, string> = {};
		const env = buildEnv({ a: UNENCRYPTED_ALBUM }, passwords);
		await upsertGalleryAlbum(env, "a", EDIT_WITH_PASSWORD);
		expect(passwords["a"]).toBe("newpass");
	});
});

describe("unlockGalleryAlbum 锁门判定以 D1 密码为准（R1 两套真相源修复）", () => {
	beforeEach(() => {});

	it("无 D1 密码时即使 frontmatter encrypted=false 也放行（未锁定）", async () => {
		const env = buildEnv({ a: UNENCRYPTED_ALBUM }, {});
		const result = await unlockGalleryAlbum(env, "a", "");
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.photos.length).toBe(1);
	});

	it("有 D1 密码但 frontmatter 无 encrypted 标记时仍视为锁定（防相册实际公开）", async () => {

		const env = buildEnv({ a: UNENCRYPTED_ALBUM }, { a: "secret123" });
		const wrong = await unlockGalleryAlbum(env, "a", "wrong");
		expect(wrong.ok).toBe(false);
		const right = await unlockGalleryAlbum(env, "a", "secret123");
		expect(right.ok).toBe(true);
	});

	it("frontmatter encrypted=true 且 D1 有密码：密码错误拒绝，正确放行", async () => {
		const env = buildEnv({ b: ENCRYPTED_ALBUM }, { b: "pw" });
		const wrong = await unlockGalleryAlbum(env, "b", "nope");
		expect(wrong.ok).toBe(false);
		const right = await unlockGalleryAlbum(env, "b", "pw");
		expect(right.ok).toBe(true);
	});

	it("frontmatter encrypted=true 但 D1 无密码：按未锁定放行（与页面用 D1 判定一致）", async () => {
		const env = buildEnv({ b: ENCRYPTED_ALBUM }, {});
		const result = await unlockGalleryAlbum(env, "b", "");
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.photos.length).toBe(1);
	});
});

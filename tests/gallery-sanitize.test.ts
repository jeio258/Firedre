import { describe, it, expect } from "vitest";
import { sanitizeGalleryAlbumForPublic } from "../server/gallery/sanitize";
import type { GalleryAlbumDetail } from "../types/gallery";

function makeAlbum(
	overrides: Record<string, unknown> = {},
): GalleryAlbumDetail {
	return {
		slug: "test",
		frontmatter: {
			layout: "gallery-album",
			title: "测试相册",
			encrypted: false,
			source: "local",
			password: "secret-123",
			photos: [{ url: "/api/gallery-files/test/files/a.jpg" }],
			...overrides,
		},
		source: undefined,
	} as unknown as GalleryAlbumDetail;
}

describe("sanitizeGalleryAlbumForPublic（相册密码不泄漏）", () => {
	it("非加密相册（D1 无密码）：剔除 password，保留照片", () => {
		const out = sanitizeGalleryAlbumForPublic(makeAlbum(), false);
		expect(out.frontmatter.password).toBeUndefined();
		expect(out.frontmatter.photos).toHaveLength(1);
		expect(out.source).toBeUndefined();
	});

	it("加密相册（D1 有密码）：剔除 password 与照片列表", () => {
		const out = sanitizeGalleryAlbumForPublic(
			makeAlbum({ encrypted: true }),
			true,
		);
		expect(out.frontmatter.password).toBeUndefined();
		expect(out.frontmatter.photos).toEqual([]);
		expect(out.source).toBeUndefined();
	});

	it("R2 encrypted=false 但 D1 有密码：仍隐藏照片（R1 判锁统一回归）", () => {

		const out = sanitizeGalleryAlbumForPublic(
			makeAlbum({ encrypted: false }),
			true,
		);
		expect(out.frontmatter.photos).toEqual([]);
		expect(out.frontmatter.encrypted).toBe(true);
		expect(out.frontmatter.password).toBeUndefined();
	});

	it("R2 encrypted=true 但 D1 无密码：按未锁定放行（与 unlockGalleryAlbum 一致）", () => {
		const out = sanitizeGalleryAlbumForPublic(
			makeAlbum({ encrypted: true }),
			false,
		);
		expect(out.frontmatter.photos).toHaveLength(1);
	});

	it("加密相册即使 frontmatter 带 password 也不会泄漏", () => {

		const out = sanitizeGalleryAlbumForPublic(
			makeAlbum({ encrypted: true, password: "should-not-leak" }),
			true,
		);
		expect(out.frontmatter.password).toBeUndefined();
	});
});

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
	it("非加密相册：剔除 password，保留照片", () => {
		const out = sanitizeGalleryAlbumForPublic(makeAlbum());
		expect(out.frontmatter.password).toBeUndefined();
		expect(out.frontmatter.photos).toHaveLength(1);
		expect(out.source).toBeUndefined();
	});

	it("加密相册：剔除 password 与照片列表", () => {
		const out = sanitizeGalleryAlbumForPublic(
			makeAlbum({ encrypted: true }),
		);
		expect(out.frontmatter.password).toBeUndefined();
		expect(out.frontmatter.photos).toEqual([]);
		expect(out.source).toBeUndefined();
	});

	it("加密相册即使 frontmatter 带 password 也不会泄漏", () => {
		// 防御性：即使未来又往 frontmatter 写了 password，公开响应也不得返回
		const out = sanitizeGalleryAlbumForPublic(
			makeAlbum({ encrypted: true, password: "should-not-leak" }),
		);
		expect(out.frontmatter.password).toBeUndefined();
	});
});

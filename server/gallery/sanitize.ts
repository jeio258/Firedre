import type { GalleryAlbumDetail } from "../../types/gallery";

/**
 * 公开 API 不返回加密相册的照片列表，也不返回任何相册密码。
 *
 * 说明：相册密码现已迁至 D1（album_passwords），frontmatter 不含 password。
 * 这里仍对 password 做显式置空（防御性），并剔除加密相册的照片列表，
 * 避免未认证访客读取敏感内容。
 */
export function sanitizeGalleryAlbumForPublic(
	detail: GalleryAlbumDetail,
): GalleryAlbumDetail {
	if (!detail.frontmatter.encrypted) {
		// 非加密相册保留照片，但防御性地清除密码字段
		return {
			...detail,
			frontmatter: {
				...detail.frontmatter,
				password: undefined,
			},
			source: undefined,
		};
	}

	return {
		slug: detail.slug,
		frontmatter: {
			...detail.frontmatter,
			password: undefined,
			photos: [],
		},
		source: undefined,
	};
}

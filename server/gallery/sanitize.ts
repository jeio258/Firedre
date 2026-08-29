import type { GalleryAlbumDetail } from "../../types/gallery";

/** 公开 API 不返回加密相册的密码与照片列表 */
export function sanitizeGalleryAlbumForPublic(
	detail: GalleryAlbumDetail,
): GalleryAlbumDetail {
	if (!detail.frontmatter.encrypted) {
		return {
			...detail,
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

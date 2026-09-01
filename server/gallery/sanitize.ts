import type { GalleryAlbumDetail } from "../../types/gallery";

export function sanitizeGalleryAlbumForPublic(
	detail: GalleryAlbumDetail,
	hasPassword: boolean,
): GalleryAlbumDetail {
	if (!hasPassword) {

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
			encrypted: true,
			photos: [],
			// 加密相册对外最小暴露：不返回 WebDAV 服务器地址/账号，避免便于定向攻击
			webdav: undefined,
		},
		source: undefined,
	};
}

import type { GalleryAlbumDetail } from "../../types/gallery";

/**
 * 公开 API 不返回加密相册的照片列表，也不返回任何相册密码。
 *
 * 判锁依据：以 D1（album_passwords）中密码是否存在为准（hasPassword 由调用方
 * 读取 D1 后传入），而非 R2 frontmatter.encrypted 标记——二者可能因写入失败
 * 不同步。只要 D1 有密码即视为上锁：隐藏照片列表、标记 encrypted，避免未认证
 * 访客在 R2 标记缺失/不同步时仍读到完整照片。
 */
export function sanitizeGalleryAlbumForPublic(
	detail: GalleryAlbumDetail,
	hasPassword: boolean,
): GalleryAlbumDetail {
	if (!hasPassword) {
		// 未上锁相册保留照片；防御性清除可能残留的 frontmatter password 字段
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

export type AlbumSource = "local" | "webdav";

/** 相册 index.md 中的 WebDAV 配置（不含密码） */
export interface AlbumWebDavFrontmatterConfig {
	url: string;
	username?: string;
}

/** 服务端完整 WebDAV 配置（密码来自环境变量） */
export interface AlbumWebDavConfig extends AlbumWebDavFrontmatterConfig {
	password?: string;
}

export type AlbumMediaType = "image" | "video";

export interface AlbumPhoto {
	url: string;
	/** 媒体类型，未填写时按链接后缀自动识别 */
	type?: AlbumMediaType;
	/** 视频封面，仅 type 为 video 时有效 */
	poster?: string;
	/** 拍摄/上传时间，建议 YYYY-MM-DD 或 ISO 8601 */
	date?: string;
}

/** 相册首页卡片条目（摘要） */
export interface AlbumSummary {
	slug: string;
	title: string;
	/** 相册排序时间 */
	date: string;
	cover?: string;
	desc?: string;
	/** 照片/视频数量（本地相册由 photos 自动统计；WebDAV 相册不显示） */
	count?: number;
	/** 拍摄地点，如「杭州市 上城区」 */
	location?: string;
	/** 相册标签 */
	tags?: string[];
	encrypted?: boolean;
	source?: AlbumSource;
}

/** 单个相册页 frontmatter */
export interface AlbumDetailFrontmatter {
	title?: string;
	cover?: string;
	desc?: string;
	date?: string;
	/** 拍摄地点，如「杭州市 上城区」 */
	location?: string;
	/** 相册标签 */
	tags?: string[];
	/** 是否显示评论（可选） */
	comment?: boolean;
	/** 是否带锁相册，在 index.md 中配置 encrypted: true/false */
	encrypted?: boolean;
	/** 相册访问密码，与 encrypted 配合使用 */
	password?: string;
	source?: AlbumSource;
	/** WebDAV 地址与账号（写在 index.md）；WebDAV 登录密码仅使用服务端环境变量 WEBDAV_PASSWORD */
	webdav?: AlbumWebDavFrontmatterConfig;
	photos?: AlbumPhoto[];
}

export interface GalleryHubFrontmatter {
	cover?: string;
	/** 相册 slug 列表，元数据请在各相册 index.md 中配置 */
	albums?: (string | { slug: string })[];
}

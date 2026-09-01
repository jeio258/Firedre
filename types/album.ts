export type AlbumSource = "local" | "webdav";

export interface AlbumWebDavFrontmatterConfig {
	url: string;
	username?: string;
}

export interface AlbumWebDavConfig extends AlbumWebDavFrontmatterConfig {
	password?: string;
}

export type AlbumMediaType = "image" | "video";

export interface AlbumPhoto {
	url: string;

	type?: AlbumMediaType;

	poster?: string;

	date?: string;
}

export interface AlbumSummary {
	slug: string;
	title: string;

	date: string;
	cover?: string;
	desc?: string;

	count?: number;

	location?: string;

	tags?: string[];
	encrypted?: boolean;
	source?: AlbumSource;
}

export interface AlbumDetailFrontmatter {
	title?: string;
	cover?: string;
	desc?: string;
	date?: string;

	location?: string;

	tags?: string[];

	comment?: boolean;

	encrypted?: boolean;

	password?: string;
	source?: AlbumSource;

	webdav?: AlbumWebDavFrontmatterConfig;
	photos?: AlbumPhoto[];
}

export interface GalleryHubFrontmatter {
	cover?: string;

	albums?: (string | { slug: string })[];
}

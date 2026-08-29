import type { GalleryHubFrontmatter } from "./album";

export interface GalleryHubDetail {
	frontmatter: GalleryHubFrontmatter & {
		title?: string;
		icon?: string;
		layout?: string;
		comment?: boolean;
	};
	albums: import("./album").AlbumSummary[];
	source?: string;
}

export interface GalleryAlbumDetail {
	slug: string;
	frontmatter: import("./album").AlbumDetailFrontmatter & {
		layout?: string;
	};
	source?: string;
}

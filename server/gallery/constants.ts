export const GALLERY_HUB_R2_KEY = "gallery/index.md";

export function galleryAlbumR2Key(slug: string) {
	return `gallery/${slug}/index.md`;
}

export function galleryHubLocalPath(root: string) {
	return `${root}/content/gallery/index.md`;
}

export function galleryAlbumLocalPath(root: string, slug: string) {
	return `${root}/content/gallery/${slug}/index.md`;
}

export function isValidGallerySlug(slug: string) {
	return /^[a-z0-9][a-z0-9-]*$/i.test(slug);
}

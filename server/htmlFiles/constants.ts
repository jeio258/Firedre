import { UserError } from "../utils/userError";

export const HTML_FILE_SLUG_RE = /^[a-z0-9][a-z0-9-]*$/i;

export const RESERVED_HTML_SLUGS = new Set([
	"baidu_verify_codeva-WzoodkR3hT",
	"index",
]);

export function htmlFileR2Key(slug: string) {
	return `html/${slug}.html`;
}

export function htmlFilePublicPath(slug: string) {
	return `/${slug}.html`;
}

export function htmlFilesLocalDir(root: string) {
	return `${root}/content/html-files`;
}

export function htmlFilesLocalIndexPath(root: string) {
	return `${htmlFilesLocalDir(root)}/index.json`;
}

export function htmlFilesLocalContentPath(root: string, slug: string) {
	if (!HTML_FILE_SLUG_RE.test(slug) || slug.includes(".."))
		throw new UserError("路径无效");
	return `${htmlFilesLocalDir(root)}/${slug}.html`;
}

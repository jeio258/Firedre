import type { PostFrontmatter } from "./posts";

export interface AboutFrontmatter
	extends Pick<
		PostFrontmatter,
		"title" | "cover" | "date" | "updated" | "comment"
	> {
	layout?: string;
}

export interface AboutDetail {
	frontmatter: AboutFrontmatter;
	html: string;
	markdown?: string;
	source?: string;
}

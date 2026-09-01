import type { AboutDetail } from "../../types/about";
import { serializeFrontmatter, splitMarkdown } from "../posts/frontmatter";
import { renderMarkdown } from "../posts/render";

function normalizeAboutFrontmatter(frontmatter: Record<string, unknown>) {
	return {
		layout: "post",
		title: frontmatter.title ? String(frontmatter.title) : "关于我",
		cover: frontmatter.cover ? String(frontmatter.cover) : undefined,
		date: frontmatter.date ? String(frontmatter.date) : undefined,
		updated: frontmatter.updated ? String(frontmatter.updated) : undefined,
		comment: frontmatter.comment === true ? true : undefined,
	};
}

export function normalizeAboutSource(source: string) {
	const { frontmatter, content } = splitMarkdown(source);
	const normalizedFm = normalizeAboutFrontmatter(
		frontmatter as Record<string, unknown>,
	);
	return serializeFrontmatter(
		{
			...normalizedFm,
			layout: "post",
		},
		content.startsWith("\n") ? content : `\n${content}`,
	);
}

export async function getAboutFromSource(
	source: string,
	options: { includeSource?: boolean } = {},
): Promise<AboutDetail> {
	const { frontmatter, content } = splitMarkdown(source);
	const rendered = await renderMarkdown(content);

	return {
		frontmatter: normalizeAboutFrontmatter(
			frontmatter as Record<string, unknown>,
		),
		html: rendered.html,
		markdown: content,
		source: options.includeSource ? source : undefined,
	};
}

import { defaultsLocals, getSiteConfig } from "@shared/config/runtime";
import type { AboutDetail } from "../../types/about";
import { serializeFrontmatter, splitMarkdown } from "../posts/frontmatter";
import { renderMarkdownCached } from "../posts/renderCache";
import { sha256Hex } from "../utils/hash";

const siteConfig = getSiteConfig(defaultsLocals);

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
	// 渲染走缓存：Markdown 渲染链在 Free 套餐 10ms CPU 上限下会随机 1102。
	// frontmatter 不影响渲染输出，键只需内容哈希。
	const rendered = await renderMarkdownCached(
		"about",
		await sha256Hex(source),
		content,
		siteConfig.site_url,
	);

	return {
		frontmatter: normalizeAboutFrontmatter(
			frontmatter as Record<string, unknown>,
		),
		html: rendered.html,
		markdown: content,
		source: options.includeSource ? source : undefined,
	};
}

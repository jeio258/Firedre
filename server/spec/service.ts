import type { CloudflareEnv } from "../../types/env";
import type { PostFrontmatter } from "../../types/posts";
import { splitMarkdown } from "../posts/frontmatter";
import { renderMarkdown } from "../posts/render";

const SPEC_R2_PREFIX = "spec/";

export function isValidSpecName(name: string): boolean {
	return /^[a-zA-Z0-9._-]+$/.test(name);
}

export interface SpecPageDetail {
	name: string;
	frontmatter: PostFrontmatter;
	html: string;
	source: string;
}

/** 读取并渲染 R2 `spec/<name>.md`（通用 Markdown 页面，如留言板） */
export async function getSpecPage(
	env: CloudflareEnv,
	name: string,
): Promise<SpecPageDetail | null> {
	if (!isValidSpecName(name)) return null;

	const object = await env.BUCKET.get(`${SPEC_R2_PREFIX}${name}.md`);
	if (!object) return null;

	const source = await object.text();
	const { frontmatter, content } = splitMarkdown(source);
	// renderMarkdown 的插件会就地写入 words/minutes/excerpt，故返回渲染后的同一对象
	const rendered = await renderMarkdown(content, { frontmatter });
	return { name, frontmatter, html: rendered.html, source };
}

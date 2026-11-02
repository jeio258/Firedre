import { defaultsLocals, getSiteConfig } from "@shared/config/runtime";
import type { CloudflareEnv } from "../../types/env";
import type { PostFrontmatter } from "../../types/posts";
import { splitMarkdown } from "../posts/frontmatter";
import { renderMarkdownCached } from "../posts/renderCache";
import { sha256Hex } from "../utils/hash";

const siteConfig = getSiteConfig(defaultsLocals);

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
	// 渲染走缓存：Markdown 渲染链在 Free 套餐 10ms CPU 上限下会随机 1102。
	// 缓存只含解析产物；frontmatter 原样返回（不参与渲染输出），无需进键。
	const version = await sha256Hex(source);
	const rendered = await renderMarkdownCached(
		`spec:${name}`,
		version,
		content,
		siteConfig.site_url,
	);
	return { name, frontmatter, html: rendered.html, source };
}

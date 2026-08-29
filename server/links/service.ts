import type { CloudflareEnv } from "../../types/env";
import type { LinksDetail } from "../../types/links";
import { renderMarkdown } from "../posts/render";
import { LINKS_R2_KEY } from "./constants";
import { parseLinksSource, serializeLinksFrontmatter } from "./frontmatter";

export async function getLinks(
	env: CloudflareEnv,
	options: { includeSource?: boolean } = {},
): Promise<LinksDetail | null> {
	const object = await env.BUCKET.get(LINKS_R2_KEY);
	if (!object) return null;

	const source = await object.text();
	const parsed = parseLinksSource(source);
	const rendered = await renderMarkdown(parsed.content || "");

	return {
		frontmatter: parsed.frontmatter,
		linkGroups: parsed.linkGroups,
		html: rendered.html,
		source: options.includeSource ? source : undefined,
	};
}

export async function upsertLinks(env: CloudflareEnv, source: string) {
	const parsed = parseLinksSource(source);
	const normalized = serializeLinksFrontmatter(
		parsed.frontmatter,
		parsed.content,
	);

	await env.BUCKET.put(LINKS_R2_KEY, normalized, {
		httpMetadata: { contentType: "text/markdown; charset=utf-8" },
	});

	return {
		r2Key: LINKS_R2_KEY,
		frontmatter: parsed.frontmatter,
		linkGroups: parsed.linkGroups,
	};
}

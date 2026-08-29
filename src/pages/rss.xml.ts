import rss, { type RSSFeedItem } from "@astrojs/rss";
import { formatDateI18nWithTime } from "@utils/date-utils";
import { url } from "@utils/url-utils";
import type { APIContext } from "astro";
import sanitizeHtml from "sanitize-html";
import { siteConfig } from "@/config";

export const prerender = false;

function stripInvalidXmlChars(str: string): string {
	return str.replace(
		/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F\uFDD0-\uFDEF\uFFFE\uFFFF]/g,
		"",
	);
}

/**
 * Firedre：RSS 从 D1 + R2 动态生成（运行时渲染全文）
 */
export async function GET(context: APIContext): Promise<Response> {
	const { listPosts, getPostBySlug } = await import(
		"../../server/posts/service"
	);
	const { cfEnv } = await import("../lib/api");

	const { posts } = await listPosts(cfEnv, { pageSize: 200 });

	const items: RSSFeedItem[] = [];
	for (const post of posts) {
		const detail = await getPostBySlug(cfEnv, post.slug, {});
		if (!detail) continue;

		const description = sanitizeHtml(detail.html || "", {
			allowedTags: [
				"a",
				"p",
				"br",
				"b",
				"strong",
				"i",
				"em",
				"u",
				"code",
				"pre",
				"ul",
				"ol",
				"li",
				"blockquote",
				"h1",
				"h2",
				"h3",
				"h4",
				"h5",
				"h6",
				"img",
				"table",
				"thead",
				"tbody",
				"tr",
				"th",
				"td",
				"span",
				"div",
			],
			allowedAttributes: {
				a: ["href", "title"],
				img: ["src", "alt", "title"],
			},
		});

		items.push({
			title: detail.title,
			link: url(`/posts/${detail.slug}/`),
			pubDate: new Date(detail.date || 0),
			...(detail.updated ? { updatedDate: new Date(detail.updated) } : {}),
			description: stripInvalidXmlChars(description),
		});
	}

	return rss({
		title: siteConfig.title,
		description: siteConfig.description as string,
		site: (context.site || siteConfig.site_url) as string,
		items,
		customData: `<language>${siteConfig.lang}</language>`,
		xmlns: { media: "http://search.yahoo.com/mrss/" },
	});
}

export { formatDateI18nWithTime };

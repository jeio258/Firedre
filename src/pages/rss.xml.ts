import rss, { type RSSFeedItem } from "@astrojs/rss";
import { url } from "@utils/url-utils";
import type { APIContext } from "astro";
import { siteConfig } from "@/config";
import { getSiteConfig } from "@/config/runtime";
import { getSettingsVersion } from "../../server/settings/service";

export const prerender = false;

function stripInvalidXmlChars(str: string): string {
	return str.replace(
		// biome-ignore lint/suspicious/noControlCharactersInRegex: 故意清除 XML 规范禁止的控制字符
		/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F\uFDD0-\uFDEF\uFFFE\uFFFF]/g,
		"",
	);
}

export async function GET(context: APIContext): Promise<Response> {
	const { listPosts } = await import("../../server/posts/service");
	const { cfEnv } = await import("../lib/api");

	// D1 不可用时降级输出仅频道信息的 feed，而非裸 500
	let posts: Awaited<ReturnType<typeof listPosts>>["posts"] = [];
	try {
		({ posts } = await listPosts(cfEnv, { pageSize: 200 }));
	} catch {
		// 文章读取失败不影响 feed 输出
	}

	const siteUrl = getSiteConfig(context.locals).site_url;
	let settingsVersion = "0";
	try {
		settingsVersion = await getSettingsVersion(cfEnv);
	} catch {
		// 版本读取失败不影响 feed 输出
	}

	// 仅用 D1 元数据 + 摘要：不读 R2、不渲染正文，避免 200 篇串行渲染
	const items: RSSFeedItem[] = posts.map((post) => ({
		title: stripInvalidXmlChars(post.title),
		link: url(`/posts/${post.slug}/`),
		pubDate: new Date(post.date || 0),
		...(post.updated ? { updatedDate: new Date(post.updated) } : {}),
		description: stripInvalidXmlChars(
			post.description || post.excerpt || post.title || "",
		),
	}));

	const resp = await rss({
		title: siteConfig.title,
		description: siteConfig.description as string,
		site: siteUrl,
		items,
		customData: `<language>${siteConfig.lang}</language>`,
		xmlns: { media: "http://search.yahoo.com/mrss/" },
	});
	// 缓存随设置版本失效：缩短 max-age 并附版本 ETag，改站点设置后最长 5 分钟即刷新
	resp.headers.set(
		"Cache-Control",
		"public, max-age=300, stale-while-revalidate=86400",
	);
	resp.headers.set("ETag", `"settings-${settingsVersion}"`);
	return resp;
}

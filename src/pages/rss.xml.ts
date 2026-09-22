import { getSettingsVersion } from "@server/settings/service";
import { url } from "@utils/url-utils";
import type { APIContext } from "astro";
import { siteConfig } from "@/config";
import { getSiteConfig } from "@/config/runtime";

export const prerender = false;

function stripInvalidXmlChars(str: string): string {
	return str.replace(
		// biome-ignore lint/suspicious/noControlCharactersInRegex: 故意清除 XML 规范禁止的控制字符
		/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F\uFDD0-\uFDEF\uFFFE\uFFFF]/g,
		"",
	);
}

// XML 文本转义（与 @astrojs/rss 输出一致）
function escapeXml(str: string): string {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
}

export async function GET(context: APIContext): Promise<Response> {
	const { listPosts } = await import("@server/posts/service");
	const { cfEnv } = await import("../lib/api");

	// D1 不可用时降级输出仅频道信息的 feed，而非裸 500
	let posts: Awaited<ReturnType<typeof listPosts>>["posts"] = [];
	try {
		({ posts } = await listPosts(cfEnv, { pageSize: 200 }));
	} catch {
		// 文章读取失败不影响 feed 输出
	}

	const siteUrl = getSiteConfig(context.locals).site_url;
	// 频道 link 与原 @astrojs/rss 输出对齐：补结尾斜杠
	const siteBase = siteUrl.endsWith("/") ? siteUrl : `${siteUrl}/`;
	let settingsVersion = "0";
	try {
		settingsVersion = await getSettingsVersion(cfEnv);
	} catch {
		// 版本读取失败不影响 feed 输出
	}

	// 仅用 D1 元数据 + 摘要：不读 R2、不渲染正文，避免 200 篇串行渲染
	// 手写 RSS 2.0 生成：移除 @astrojs/rss（及其 zod 依赖）以缩小 SSR worker 体积
	const items = posts
		.map((post) => {
			// 绝对 URL（原 @astrojs/rss 以 site 解析相对路径；手写实现需自行拼接）
			const link = escapeXml(
				new URL(url(`/posts/${post.slug}/`), siteUrl).toString(),
			);
			const title = escapeXml(stripInvalidXmlChars(post.title ?? ""));
			const description = escapeXml(
				stripInvalidXmlChars(
					post.description || post.excerpt || post.title || "",
				),
			);
			const pubDate = new Date(post.date || 0).toUTCString();
			return `<item><title>${title}</title><link>${link}</link><guid isPermaLink="true">${link}</guid><description>${description}</description><pubDate>${pubDate}</pubDate></item>`;
		})
		.join("");

	const xml =
		`<?xml version="1.0" encoding="UTF-8"?>` +
		`<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">` +
		"<channel>" +
		`<title>${escapeXml(siteConfig.title)}</title>` +
		`<description>${escapeXml(String(siteConfig.description ?? ""))}</description>` +
		`<link>${escapeXml(siteBase)}</link>` +
		`<language>${escapeXml(siteConfig.lang)}</language>` +
		items +
		"</channel></rss>";

	return new Response(xml, {
		headers: {
			"Content-Type": "application/xml",
			// 缓存随设置版本失效：缩短 max-age 并附版本 ETag，改站点设置后最长 5 分钟即刷新
			"Cache-Control": "public, max-age=300, stale-while-revalidate=86400",
			ETag: `"settings-${settingsVersion}"`,
		},
	});
}

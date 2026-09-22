// 客户端 i18n 词典端点：把 Layout 内联的 ~50KB 翻译表改为独立请求（CDN 缓存 1 天），
// 首页 HTML 少 ~50KB 解析、跨页浏览器/边缘缓存。仅引入当前构建语言（siteConfig.lang）。
import { zh_CN } from "@i18n/languages/zh_CN";

export function GET() {
	return new Response(`window.__FIREDRE_I18N__ = ${JSON.stringify(zh_CN)};`, {
		headers: {
			"Content-Type": "application/javascript",
			"Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
		},
	});
}

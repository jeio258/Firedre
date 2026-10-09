// HTML 边缘缓存键（middleware 使用）。
// 现有 HTML 页均按 path 渲染（查询串只被 API 端点消费，客户端筛选在浏览器侧进行），
// 故键不含 search —— 避免 ?utm_* / fbclid 等跟踪参数导致缓存恒 miss、直落全量 SSR。
// 若将来新增"按 query 渲染"的页，必须把该 query 纳入键（或改用白名单）。
export function buildHtmlCacheKey(url: URL, version: string): string {
	return `${url.origin}/__html_cache__/${url.pathname}?v=${version}`;
}

// vendored katex 资产（public/katex/，无内容哈希）→ 用查询串做缓存失效：
// 升级 katex 版本、或改动裁剪补丁（如去 ttf）时必须递增 KATEX_ASSET_VERSION，
// 否则 /katex/* 的 7 天边缘/浏览器缓存会继续回放旧文件（曾导致旧 CSS 引用已删除的 ttf）。
// 注：不为 /katex/* 加 immutable —— 非内容哈希路径加 immutable 会让更新永久无法生效。
export const KATEX_ASSET_VERSION = "0.18.4-1";

export function katexStylesheetPath(): string {
	return `/katex/katex.min.css?v=${KATEX_ASSET_VERSION}`;
}

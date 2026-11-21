import type { MarkdownHeading } from "../../types/posts";
import { edgeCacheGet, edgeCacheSet } from "../utils/edgeCache";
import { createLruTtlCache } from "../utils/lruTtlCache";
import { detectMarkdownFeatures, renderMarkdown } from "./render";

/**
 * Markdown 渲染结果缓存（scope+内容哈希 为键）。
 *
 * 为什么需要：Cloudflare Pages Functions（Free 套餐）单次调用 CPU 上限 10ms，
 * 而 unified 渲染链冷建 15~26ms、全量插件链处理中位数 7~15ms，
 * 超限即 Error 1102「Worker exceeded resource limits」，表现为随机 503。
 *
 * 键语义：version 为内容 sha256，内容变更即键变化，不会读到旧 HTML。
 * 陈旧性风险（与下游一致、已接受）：本模块不缓存携带 wiki-link 解析器的渲染——
 * wiki-link 输出依赖被链接文章的数据而非本文内容，文章详情走 service.ts 的
 * 内容+配置双键缓存；此处调用点（spec/about）均不传解析器。
 * 只缓存解析产物（html/headings/words/minutes/excerpt），不缓存请求级数据。
 */

const L1_MAX_ENTRIES = 64;
const L2_TTL_SECONDS = 3600;

export interface CachedRender {
	html: string;
	headings: MarkdownHeading[];
	words: number;
	minutes: number;
	excerpt: string;
}

const l1 = createLruTtlCache<CachedRender>(L1_MAX_ENTRIES);

// workerd 的 Cache API 要求绝对 URL 键；origin 由调用方传入（站点配置 site_url）
function l2Url(scope: string, version: string, origin: string): string {
	return `${origin}/__md_render_cache__/${encodeURIComponent(scope)}/${encodeURIComponent(version)}`;
}

function isValidCached(value: unknown): value is CachedRender {
	if (!value || typeof value !== "object") return false;
	const v = value as Record<string, unknown>;
	return typeof v.html === "string" && Array.isArray(v.headings);
}

/**
 * @param scope 缓存作用域（如 `spec:privacy`、`about`），用于区分不同页面
 * @param version 内容版本（内容 sha256），内容变化即失效
 * @param origin 站点 origin（L2 缓存键需要绝对 URL；缺省则只用 L1）
 */
export async function renderMarkdownCached(
	scope: string,
	version: string,
	content: string,
	origin?: string,
): Promise<CachedRender> {
	const key = `${scope}@${version}`;

	const hitL1 = l1.get(key);
	if (hitL1) return hitL1;

	// L2：边缘 Cache API（无缓存环境或读写失败均不影响主流程）
	if (origin) {
		const parsed = await edgeCacheGet<CachedRender>(
			l2Url(scope, version, origin),
			isValidCached,
		);
		if (parsed) {
			l1.set(key, parsed);
			return parsed;
		}
	}

	// 按内容特征裁剪重型插件：内容里不存在的语法不装配对应插件，语义不变
	const rendered = await renderMarkdown(content, {
		features: detectMarkdownFeatures(content),
	});
	const value: CachedRender = {
		html: rendered.html,
		headings: rendered.headings,
		words: rendered.words,
		minutes: rendered.minutes,
		excerpt: rendered.excerpt,
	};

	l1.set(key, value);

	if (origin) {
		await edgeCacheSet(
			l2Url(scope, version, origin),
			value,
			`public, max-age=${L2_TTL_SECONDS}`,
		);
	}

	return value;
}

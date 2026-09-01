/**
 * 前端 HTML 消毒器（基于浏览器 DOM）
 *
 * 用于动态 / Memos / 第三方 API 渲染出的、未经过服务端 rehype 消毒的 HTML。
 * 在注入 innerHTML 之前过滤危险内容，作为服务端消毒之外的纵深防御：
 *  - 移除 script/style/iframe/object/embed/link/meta/base/template 等非内容标签
 *  - 移除全部 on* 事件属性、srcdoc
 *  - 拦截 javascript:/data:/vbscript: 等危险 scheme（href/src/xlink:href/formaction）
 *  - 保留文本、链接、图片、列表、表格等安全内容标签
 *
 * 仅在浏览器环境调用（依赖 document）。
 */

const REMOVED_TAGS = new Set([
	"script",
	"style",
	"iframe",
	"object",
	"embed",
	"link",
	"meta",
	"base",
	"template",
	"form",
	"input",
	"button",
	"textarea",
	"select",
	"svg",
	"math",
]);

const ALLOWED_TAGS = new Set([
	"a",
	"p",
	"br",
	"b",
	"strong",
	"i",
	"em",
	"u",
	"s",
	"strike",
	"del",
	"ins",
	"mark",
	"small",
	"sub",
	"sup",
	"code",
	"pre",
	"blockquote",
	"ul",
	"ol",
	"li",
	"dl",
	"dt",
	"dd",
	"h1",
	"h2",
	"h3",
	"h4",
	"h5",
	"h6",
	"table",
	"thead",
	"tbody",
	"tfoot",
	"tr",
	"th",
	"td",
	"caption",
	"col",
	"colgroup",
	"figure",
	"figcaption",
	"img",
	"hr",
	"span",
	"div",
	"details",
	"summary",
	"video",
	"audio",
	"source",
	"track",
]);
import { safeUrlScheme } from "../../server/utils/safeUrl";

function isSafeUrl(raw: string | null | undefined): boolean {
	if (!raw) return true;
	// 相对地址与协议相对地址安全；拦截明确/经过空白混淆的 javascript: 等（含 ftp）
	return safeUrlScheme(raw, { schemes: ["http", "https", "mailto", "tel", "ftp"] }) !== null;
}

/**
 * 消毒一段 HTML 字符串，返回可在 innerHTML 安全使用的干净 HTML。
 * 在无 document（SSR / 非浏览器）环境返回空串。
 */
export function sanitizeDynamicHtml(input: string): string {
	if (!input) return "";
	if (typeof document === "undefined") return "";
	const template = document.createElement("template");
	template.innerHTML = input;
	const root = template.content;

	function clean(node: Node) {
		if (node.nodeType === Node.ELEMENT_NODE) {
			const el = node as HTMLElement;
			const tag = el.tagName.toLowerCase();
			if (!ALLOWED_TAGS.has(tag) || REMOVED_TAGS.has(tag)) {
				// 危险标签：保留其安全子节点（文本/安全元素），丢弃节点本身
				while (el.firstChild) {
					const child = el.firstChild;
					el.parentNode?.insertBefore(child, el);
				}
				el.remove();
				return;
			}
			// 移除所有属性，仅重建安全属性
			const allowedAttrs: Record<string, string> = {};
			for (const attr of Array.from(el.attributes)) {
				const name = attr.name.toLowerCase();
				if (name.startsWith("on")) continue;
				if (name === "srcdoc") continue;
				if (
					name === "href" ||
					name === "src" ||
					name === "xlink:href" ||
					name === "formaction"
				) {
					if (!isSafeUrl(attr.value)) continue;
				}
				allowedAttrs[name] = attr.value;
			}
			// 重建允许的属性（避免 style/class 注入脚本）
			for (const name of Object.keys(el.attributes)) el.removeAttribute(name);
			for (const [name, value] of Object.entries(allowedAttrs)) {
				if (name === "style") continue; // 丢弃内联 style，避免 CSS 注入
				el.setAttribute(name, value);
			}
		}
		for (const child of Array.from(node.childNodes)) clean(child);
	}

	clean(root);
	return template.innerHTML;
}

/**
 * 从 HTML 提取纯文本摘要（不触发事件处理器）。
 * 内部先经消毒器移除 script/iframe/事件属性后再读取 textContent。
 */
export function dynamicHtmlToText(html: string): string {
	if (typeof document === "undefined") return "";
	const sanitized = sanitizeDynamicHtml(html);
	const div = document.createElement("div");
	div.innerHTML = sanitized;
	return div.textContent?.trim() || "";
}

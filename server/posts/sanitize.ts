/**
 * HAST 安全消毒：在 rehypeRaw 之后执行，移除 Markdown 原始 HTML 中的危险内容。
 * 作为 allowDangerousHtml 的兜底防护；不依赖 sanitize-html（避免误伤 KaTeX/Mermaid 输出）。
 */

/** 需要整体移除的危险标签（可承载脚本/表单/外部资源注入） */
const UNSAFE_TAG_NAMES = new Set([
	"script",
	"object",
	"embed",
	"form",
	"base",
	"link",
	"meta",
	"style",
	"noscript",
	"template",
	"frame",
	"frameset",
	"applet",
]);

/** 需净化的 URL 属性名 */
const URL_PROPERTY_NAMES = new Set([
	"href",
	"src",
	"xlink:href",
	"action",
	"formaction",
	"poster",
	"cite",
	"background",
]);

/** 直接删除的属性（iframe srcdoc 可内嵌脚本） */
const STRIP_ATTRIBUTE_NAMES = new Set(["srcdoc"]);

export function sanitizeUrl(value: unknown): string | undefined {
	if (typeof value !== "string") return undefined;
	// WHATWG URL 解析会把 scheme 内的 ASCII tab/CR/LF 剥离，因此
	// `java\tscript:`、`java\nscript:` 等会被浏览器当作 javascript: 执行。
	// 必须先移除这些控制字符再做 scheme 白名单检查，否则可绕过本校验。
	const v = value.replace(/[\t\r\n]/g, "").trim();
	const lower = v.toLowerCase();
	if (
		lower.startsWith("javascript:") ||
		lower.startsWith("vbscript:") ||
		lower.startsWith("file:")
	)
		return undefined;
	if (lower.startsWith("data:")) {
		// 仅放行 data:image/*（LQIP/内联图）；svg+xml 可内嵌脚本，一并拦截
		if (!lower.startsWith("data:image/") || lower.includes("svg"))
			return undefined;
	}
	return v;
}

/**
 * 递归清理 HAST：移除危险标签、事件处理器属性（on*）与危险 URL。
 */
export function sanitizeHast(node: unknown): unknown {
	const n = node as {
		type?: string;
		tagName?: string;
		properties?: Record<string, unknown>;
		children?: unknown[];
	};
	if (n?.type === "element") {
		const tag = String(n.tagName || "").toLowerCase();
		if (UNSAFE_TAG_NAMES.has(tag)) return null;

		if (n.properties && typeof n.properties === "object") {
			for (const key of Object.keys(n.properties)) {
				const lowerKey = key.toLowerCase();
				if (lowerKey.startsWith("on") || STRIP_ATTRIBUTE_NAMES.has(lowerKey)) {
					delete n.properties[key];
					continue;
				}
				if (URL_PROPERTY_NAMES.has(lowerKey)) {
					const clean = sanitizeUrl(n.properties[key]);
					if (clean === undefined) delete n.properties[key];
					else n.properties[key] = clean;
				}
			}
		}
	}
	if (Array.isArray(n?.children)) {
		n.children = n.children
			.map(sanitizeHast)
			.filter((child) => child !== null);
	}
	return n;
}

/** rehype 插件形态：在 unified 管线中作为兜底消毒步骤 */
export function rehypeSanitizeDangerous() {
	return (tree: unknown) => {
		sanitizeHast(tree);
	};
}

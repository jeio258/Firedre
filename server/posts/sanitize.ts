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
	"math",
	"mtext",
	"mglyph",
	"annotation-xml",
	"input",
	"textarea",
	"select",
	"keygen",
]);

const URL_PROPERTY_NAMES = new Set([
	"href",
	"src",
	"srcset",
	"xlink:href",
	"xlinkhref",
	"action",
	"formaction",
	"poster",
	"cite",
	"background",
	"data",
]);

function sanitizeSrcset(value: unknown): string | undefined {
	if (typeof value !== "string") return undefined;
	const parts = value.split(",").map((p) => p.trim());
	const cleaned: string[] = [];
	for (const part of parts) {
		if (!part) continue;
		const [url, ...descriptor] = part.split(/\s+/);
		const clean = sanitizeUrl(url);
		if (clean === undefined) continue; // 丢弃危险候选
		cleaned.push(
			descriptor.length ? `${clean} ${descriptor.join(" ")}` : clean,
		);
	}
	return cleaned.length ? cleaned.join(", ") : undefined;
}

const STRIP_ATTRIBUTE_NAMES = new Set(["srcdoc"]);

export function sanitizeUrl(value: unknown): string | undefined {
	if (typeof value !== "string") return undefined;

	const v = value.replace(/[\t\r\n]/g, "").trim();
	const lower = v.toLowerCase();
	if (
		lower.startsWith("javascript:") ||
		lower.startsWith("vbscript:") ||
		lower.startsWith("file:")
	)
		return undefined;
	if (lower.startsWith("data:")) {
		if (!lower.startsWith("data:image/") || lower.includes("svg"))
			return undefined;
	}
	return v;
}

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
					if (lowerKey === "srcset") {
						const clean = sanitizeSrcset(n.properties[key]);
						if (clean === undefined) delete n.properties[key];
						else n.properties[key] = clean;
					} else {
						const clean = sanitizeUrl(n.properties[key]);
						if (clean === undefined) delete n.properties[key];
						else n.properties[key] = clean;
					}
				}
			}
		}
	}
	if (Array.isArray(n?.children)) {
		n.children = n.children.map(sanitizeHast).filter((child) => child !== null);
	}
	return n;
}

export function rehypeSanitizeDangerous() {
	return (tree: unknown) => {
		sanitizeHast(tree);
	};
}

/** 响应脱敏：删除口令字段；加密文章再删除正文相关字段（不回填 encrypted 标记） */
export function redactPostSecrets<T>(post: T): T {
	const copy = { ...(post as Record<string, unknown>) };
	const isEncrypted = Boolean(
		copy.password ??
			(copy as { frontmatter?: { password?: unknown } }).frontmatter?.password,
	);
	delete copy.password;
	delete copy.passwordHint;
	if (copy.frontmatter && typeof copy.frontmatter === "object") {
		const fm = { ...(copy.frontmatter as Record<string, unknown>) };
		delete fm.password;
		delete fm.passwordHint;
		copy.frontmatter = fm;
	}
	if (isEncrypted) {
		delete copy.html;
		delete copy.headings;
		delete copy.source;
		delete copy.markdown;
	}
	return copy as T;
}

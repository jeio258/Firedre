import { visit } from "unist-util-visit";

export default function rehypeImageReferrerPolicy(options = {}) {
	const domains = options.domains || [];
	if (domains.length === 0) {
		// 无配置时返回空 transformer
		return () => {};
	}

	function matchesDomain(urlStr) {
		if (typeof urlStr !== "string" || !urlStr.startsWith("http")) return false;
		try {
			const hostname = new URL(urlStr).hostname;
			return domains.some((pattern) => {
				// 先完整转义正则元字符，再把用户写的 * 通配符还原为 .*
				const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
				const regexPattern = escaped.replace(/\\\*/g, ".*");
				return new RegExp(`^${regexPattern}$`).test(hostname);
			});
		} catch {
			return false;
		}
	}

	return (tree) => {
		visit(tree, "element", (node) => {
			if (node.tagName !== "img") return;
			if (node.properties?.referrerPolicy || node.properties?.referrerpolicy)
				return;

			const src = node.properties?.src;
			if (matchesDomain(src)) {
				node.properties.referrerPolicy = "no-referrer";
			}
		});
	};
}

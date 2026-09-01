import { visit } from "unist-util-visit";

export default function rehypeExternalLinks(options = {}) {
	const siteUrl = options.siteUrl || "";
	let siteHost = "";
	try {
		siteHost = new URL(siteUrl).host;
	} catch (_e) {

	}

	return (tree) => {
		visit(tree, "element", (node) => {
			if (node.tagName !== "a") return;

			const href = node.properties?.href;
			if (typeof href !== "string") return;

			// 只处理 http/https 绝对链接
			if (!href.startsWith("http://") && !href.startsWith("https://")) return;

			// 跳过本站链接
			if (siteHost) {
				try {
					if (new URL(href).host === siteHost) return;
				} catch (_e) {

				}
			}

			node.properties.target = "_blank";
			node.properties.rel = "noopener noreferrer";
		});
	};
}

/**
 * 动态条目纯函数工具（无渲染依赖，供迁移脚本与 service 共用）
 */

const markdownImagePattern = /!\[([^\]]*)\]\((\S+?)(?:\s+["']([^"']*)["'])?\)/g;

export function extractDynamicImages(
	markdown: string,
): Array<{ alt: string; src: string; title?: string }> {
	const images: Array<{ alt: string; src: string; title?: string }> = [];
	for (const match of markdown.matchAll(markdownImagePattern)) {
		images.push({
			alt: match[1] || "",
			src: match[2],
			...(match[3] ? { title: match[3] } : {}),
		});
	}
	return images;
}

export function dynamicPlainText(markdown: string): string {
	return (markdown || "")
		.replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
		.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
		.replace(/<[^>]+>/g, " ")
		.replace(/[#>*_`~[\]()-]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

export function dynamicSearchText(markdown: string, location?: string): string {
	return [dynamicPlainText(markdown), location || ""]
		.filter(Boolean)
		.join(" ")
		.toLocaleLowerCase();
}

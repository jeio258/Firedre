/**
 * Markdown 文本工具：摘要提取（运行时/脚本通用）
 */

/** 去除 Markdown 标记，用于 FTS 索引 */
export function stripMarkdown(content: string) {
	return content
		.replace(/```[\s\S]*?```/g, " ")
		.replace(/`[^`]+`/g, " ")
		.replace(/![[^\]]*]\([^)]+\)/g, " ")
		.replace(/\[[^\]]*]\([^)]+\)/g, " ")
		.replace(/[#>*_~-]+/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

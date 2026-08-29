/**
 * Markdown 文本工具：字数、阅读时长、摘要提取（运行时/脚本通用）
 */

export function countWords(text: string): number {
	const trimmed = text.trim();
	if (!trimmed) return 0;
	// 中英文混合计数：CJK 字符按字计，其余按空白分词
	const cjk =
		trimmed.match(/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g)?.length ?? 0;
	const words = trimmed.split(/\s+/).filter(Boolean).length;
	return cjk + words;
}

export function estimateMinutes(words: number): number {
	return Math.max(1, Math.round(words / 250));
}

/** 取 Markdown 正文第一段纯文本（作为摘要兜底） */
export function firstParagraphText(markdown: string): string {
	for (const line of markdown.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		if (
			trimmed.startsWith("#") ||
			trimmed.startsWith("```") ||
			trimmed.startsWith(">")
		)
			continue;
		return trimmed
			.replace(/!\[[^\]]*]\([^)]+\)/g, " ")
			.replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
			.trim()
			.slice(0, 200);
	}
	return "";
}

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

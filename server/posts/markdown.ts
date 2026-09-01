

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

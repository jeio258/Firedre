// 统一 HTML 转义：多个历史实现（search-api/toc-shared/Calendar 内联等）收口于此
export function escapeHtml(text: string): string {
	return String(text).replace(/[&<>"']/g, (c) => {
		switch (c) {
			case "&":
				return "&amp;";
			case "<":
				return "&lt;";
			case ">":
				return "&gt;";
			case '"':
				return "&quot;";
			default:
				return "&#39;";
		}
	});
}

export function escapeHtmlAttr(value: string): string {
	return escapeHtml(value);
}

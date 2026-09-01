

export interface TocInput {

	depth: number;

	slug: string;

	text: string;
}

export interface TocItem {
	headingId: string;
	href: string;

	depthLevel: 0 | 1 | 2;

	badgeKind: "index" | "dot" | "dot-sm";

	badgeIndex?: number;
	text: string;
	labelPrimary: boolean;
}

export function computeTocItems(
	headings: TocInput[],
	opts: { maxLevel: number },
): TocItem[] {
	if (!headings || headings.length === 0) return [];

	// 计算最小深度
	let minDepth = 10;
	for (const h of headings) {
		minDepth = Math.min(minDepth, h.depth);
	}

	// 过滤：depth < minDepth + maxLevel
	const filtered = headings.filter((h) => h.depth < minDepth + opts.maxLevel);

	const items: TocItem[] = [];
	let indexCount = 1;

	for (const h of filtered) {
		// 跳过没有锚点的标题
		if (!h.slug) continue;

		const depth = h.depth;
		const depthLevel: 0 | 1 | 2 =
			depth === minDepth ? 0 : depth === minDepth + 1 ? 1 : 2;

		let badgeKind: "index" | "dot" | "dot-sm";
		let badgeIndex: number | undefined;
		if (depth === minDepth) {
			badgeKind = "index";
			badgeIndex = indexCount;
			indexCount++;
		} else if (depth === minDepth + 1) {
			badgeKind = "dot";
		} else {
			badgeKind = "dot-sm";
		}

		const text = (h.text || "").replace(/#+\s*$/, "").trim() || h.slug;

		items.push({
			headingId: h.slug,
			href: `#${h.slug}`,
			depthLevel,
			badgeKind,
			badgeIndex,
			text,
			labelPrimary: depth <= minDepth + 1,
		});
	}

	return items;
}

function escapeHtmlAttr(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

function renderBadgeInnerHTML(item: TocItem): string {
	if (item.badgeKind === "index") return String(item.badgeIndex ?? "");
	if (item.badgeKind === "dot") return '<span class="toc-badge-dot"></span>';
	return '<span class="toc-badge-dot toc-badge-dot-sm"></span>';
}

export function renderTocItemHTML(item: TocItem): string {
	const escaped = escapeHtmlAttr(item.text);
	return `
        <a
          href="${item.href}"
		  class="toc-item toc-level-${item.depthLevel}"
          data-heading-id="${item.headingId}"
		  aria-label="${escaped}"
		  title="${escaped}"
        >
			  <div class="toc-badge ${item.badgeKind === "index" ? "toc-badge-index" : ""}">
            ${renderBadgeInnerHTML(item)}
          </div>
			  <div class="toc-label ${item.labelPrimary ? "toc-label-primary" : "toc-label-secondary"}">${item.text}</div>
        </a>
      `;
}

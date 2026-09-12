// 分页页码窗口算法（SSR Pagination 与 ClientPagination 共用）
// 产出：可见页码数组，省略位以 ELLIPSIS 标记（由模板渲染为展开/跳转控件）
export const PAGINATION_ELLIPSIS = "ellipsis";
export type PaginationItem = number | typeof PAGINATION_ELLIPSIS;

const ADJ_DIST = 2;
const VISIBLE = ADJ_DIST * 2 + 1;

export function computePaginationPages(
	current: number,
	lastPage: number,
): PaginationItem[] {
	const HIDDEN = PAGINATION_ELLIPSIS;

	let count = 1;
	let l = current;
	let r = current;
	while (0 < l - 1 && r + 1 <= lastPage && count + 2 <= VISIBLE) {
		count += 2;
		l--;
		r++;
	}
	while (0 < l - 1 && count < VISIBLE) {
		count++;
		l--;
	}
	while (r + 1 <= lastPage && count < VISIBLE) {
		count++;
		r++;
	}

	const pages: PaginationItem[] = [];
	if (l > 1) pages.push(1);
	if (l === 3) pages.push(2);
	if (l > 3) pages.push(HIDDEN);
	for (let i = l; i <= r; i++) pages.push(i);
	if (r < lastPage - 2) pages.push(HIDDEN);
	if (r === lastPage - 2) pages.push(lastPage - 1);
	if (r < lastPage) pages.push(lastPage);

	return pages;
}

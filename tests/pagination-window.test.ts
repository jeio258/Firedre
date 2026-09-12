import { describe, expect, it } from "vitest";
import {
	computePaginationPages,
	PAGINATION_ELLIPSIS as E,
} from "../src/utils/pagination-window";

const pages = (current: number, lastPage: number) =>
	computePaginationPages(current, lastPage);

describe("computePaginationPages", () => {
	it("lastPage=1 仅当前页", () => {
		expect(pages(1, 1)).toEqual([1]);
	});

	it("totalPage≤7 全量展示", () => {
		expect(pages(1, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
		expect(pages(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
		expect(pages(7, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
		expect(pages(3, 6)).toEqual([1, 2, 3, 4, 5, 6]);
	});

	it("首页附近：无前省略号", () => {
		expect(pages(1, 10)).toEqual([1, 2, 3, 4, 5, E, 10]);
		expect(pages(2, 10)).toEqual([1, 2, 3, 4, 5, E, 10]);
	});

	it("中段：双侧省略号", () => {
		expect(pages(5, 10)).toEqual([1, 2, 3, 4, 5, 6, 7, E, 10]);
		expect(pages(4, 10)).toEqual([1, 2, 3, 4, 5, 6, E, 10]);
	});

	it("末页附近：无后省略号", () => {
		expect(pages(9, 10)).toEqual([1, E, 6, 7, 8, 9, 10]);
		expect(pages(10, 10)).toEqual([1, E, 6, 7, 8, 9, 10]);
	});

	it("current=9 补出页 6（SSR/CSR 统一后的行为）", () => {
		expect(pages(9, 10)).toContain(6);
	});

	it("始终包含首页与末页、当前页居中存在", () => {
		for (let cur = 1; cur <= 10; cur++) {
			const arr = pages(cur, 10);
			expect(arr[0]).toBe(1);
			expect(arr[arr.length - 1]).toBe(10);
			expect(arr).toContain(cur);
		}
	});

	it("省略号至多两个", () => {
		for (let cur = 1; cur <= 10; cur++) {
			const arr = pages(cur, 10);
			const dots = arr.filter((p) => p === E).length;
			expect(dots).toBeLessThanOrEqual(2);
		}
	});
});

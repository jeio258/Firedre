import { describe, it, expect } from "vitest";
import { categoryPathFromFrontmatter } from "../server/posts/frontmatter";
import type { PostFrontmatter } from "../types/posts";

/** 与 syncPostTaxonomy 相同的解析逻辑：优先 categories，回退单数 category */
function resolveCategoryPath(fm: PostFrontmatter): string {
	const resolved =
		(fm.categories?.length ?? 0) > 0
			? fm.categories
			: fm.category
				? [String(fm.category)]
				: undefined;
	return categoryPathFromFrontmatter(resolved);
}

describe("分类解析（syncPostTaxonomy 修复）", () => {
	it("categories 存在时使用 categories", () => {
		expect(resolveCategoryPath({ categories: ["测试"] } as PostFrontmatter)).toBe("测试");
		expect(resolveCategoryPath({ categories: ["a", "b"] } as PostFrontmatter)).toBe("a/b");
	});

	it("只有单数 category 时回退使用 category", () => {
		expect(resolveCategoryPath({ category: "测试" } as PostFrontmatter)).toBe("测试");
	});

	it("categories 与 category 都为空时才是 Uncategorized", () => {
		expect(resolveCategoryPath({} as PostFrontmatter)).toBe("Uncategorized");
		expect(resolveCategoryPath({ category: "" } as PostFrontmatter)).toBe("Uncategorized");
	});

	it("categories 为空数组时回退 category", () => {
		expect(resolveCategoryPath({ categories: [], category: "测试" } as PostFrontmatter)).toBe("测试");
	});
});

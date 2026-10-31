import { describe, expect, it } from "vitest";
import {
	CATEGORIES,
	FIELD_ORDER,
	GROUPS,
} from "../src/components/admin/adminSettingsSchema";

describe("站点设置分类与顺序", () => {
	it("每组 category 均在 CATEGORIES 内", () => {
		for (const g of GROUPS) expect(CATEGORIES).toContain(g.category);
	});

	it("组 key 无重复", () => {
		const keys = GROUPS.map((g) => g.key);
		expect(new Set(keys).size).toBe(keys.length);
	});

	it("按分类聚合后各组顺序与预期一致", () => {
		const byCat: Record<string, string[]> = {};
		for (const g of GROUPS) {
			if (!byCat[g.category]) byCat[g.category] = [];
			byCat[g.category].push(g.key);
		}
		expect(byCat["站点配置"]).toEqual(["basic", "profile"]);
		expect(byCat["外观布局"]).toEqual([
			"nav",
			"sidebar",
			"theme",
			"panel",
			"effects",
			"font",
			"cover",
			"expressiveCode",
		]);
		expect(byCat["功能配置"]).toEqual([
			"post",
			"comment",
			"music",
			"hitokoto",
			"mermaid",
			"plantuml",
		]);
		expect(byCat["页面配置"]).toEqual([
			"bilibili",
			"myanimelist",
			"vndb",
			"bangumi",
			"sponsor",
			"bookmarks",
		]);
		expect(byCat["扩展功能"]).toEqual([
			"footer",
			"ads",
			"license",
			"analytics",
		]);
	});

	it("FIELD_ORDER 覆盖所列组的全部非隐藏字段（无遗漏）", () => {
		for (const g of GROUPS) {
			const order = FIELD_ORDER[g.key];
			if (!order) continue;
			for (const f of g.fields) {
				if (f.hidden) continue;
				expect(order, `${g.key}.${f.name} 未列入 FIELD_ORDER`).toContain(
					f.name,
				);
			}
		}
	});

	it("重排后组内字段顺序与 FIELD_ORDER 一致", () => {
		for (const g of GROUPS) {
			const order = FIELD_ORDER[g.key];
			if (!order) continue;
			const names = g.fields.filter((f) => !f.hidden).map((f) => f.name);
			const expected = [...names].sort(
				(a, b) =>
					(order.indexOf(a) === -1 ? 1e9 : order.indexOf(a)) -
					(order.indexOf(b) === -1 ? 1e9 : order.indexOf(b)),
			);
			expect(names, `${g.key} 组内顺序`).toEqual(expected);
		}
	});
});

import { describe, it, expect } from "vitest";
import { getBooknavConfig } from "../src/config/runtime";
import { booknavConfig } from "../src/config/booknavConfig";

describe("runtime.getBooknavConfig（书签导航后台化）", () => {
	it("后台 bookmarks.groups 为 JSON 字符串时，返回解析后的分组（覆盖静态默认值）", () => {
		const custom = [
			{ id: "custom", name: "自定义", weight: 50, items: [{ title: "Example", url: "https://example.com", weight: 1 }] },
		];
		const cfg = getBooknavConfig({ settings: { bookmarks: { groups: JSON.stringify(custom) } } });
		expect(cfg.groups).toEqual(custom);
		expect(cfg.groups.length).toBe(1);
		expect(cfg.groups[0].id).toBe("custom");
	});

	it("后台 bookmarks.groups 已为数组时（dev D1 归一化后），直接使用", () => {
		const arr = [{ id: "a", name: "A", weight: 1, items: [] }];
		const cfg = getBooknavConfig({ settings: { bookmarks: { groups: arr } } });
		expect(cfg.groups).toBe(arr);
	});

	it("后台未配置 groups 时，回退静态 booknavConfig（保证纯静态部署可用）", () => {
		const cfg = getBooknavConfig({ settings: {} });
		expect(cfg.groups.length).toBe(booknavConfig.length);
		expect(cfg.groups.some((g) => g.id === "dev")).toBe(true);
	});

	it("后台 favicon 覆盖静态默认值", () => {
		const cfg = getBooknavConfig({
			settings: { bookmarks: { favicon: JSON.stringify({ enabled: false, api: "https://x.test/{domain}" }) } },
		});
		expect(cfg.favicon.enabled).toBe(false);
		expect(cfg.favicon.api).toBe("https://x.test/{domain}");
	});

	it("后台配置 title/description 优先于静态默认", () => {
		const cfg = getBooknavConfig({ settings: { bookmarks: { title: "我的书签", description: "描述" } } });
		expect(cfg.title).toBe("我的书签");
		expect(cfg.description).toBe("描述");
	});
});

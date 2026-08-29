import { describe, it, expect } from "vitest";

// 模拟 middleware 中的配置合并逻辑（提取为纯函数便于测试）
function normalizeValue(v: unknown): unknown {
	if (typeof v === "string") {
		const t = v.trim();
		if (
			(t.startsWith("[") || t.startsWith("{")) &&
			(t.endsWith("]") || t.endsWith("}"))
		) {
			try {
				return JSON.parse(t);
			} catch {
				return v;
			}
		}
	}
	return v;
}

function assignFlat(
	target: Record<string, unknown>,
	g: Record<string, unknown>,
): void {
	for (const [k, v] of Object.entries(g)) {
		if (v !== "" && v != null) target[k] = v;
	}
}

function mergeSettings(
	defaults: Record<string, unknown>,
	dbSettings: Record<string, unknown>,
): Record<string, unknown> {
	const merged: Record<string, unknown> = {};

	// 1. 先铺默认值（嵌套组 + 平铺标量）
	for (const [groupKey, group] of Object.entries(defaults)) {
		const g: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(group as Record<string, unknown> ?? {})) {
			g[k] = normalizeValue(v);
		}
		merged[groupKey] = g;
		assignFlat(merged, g);
	}

	// 2. 数据库值覆盖其上
	for (const [groupKey, group] of Object.entries(dbSettings)) {
		const g: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(group as Record<string, unknown> ?? {})) {
			g[k] = normalizeValue(v);
		}
		merged[groupKey] = {
			...(merged[groupKey] as Record<string, unknown> ?? {}),
			...g,
		};
		assignFlat(merged, g);
	}

	return merged;
}

describe("normalizeValue", () => {
	it("should parse valid JSON arrays", () => {
		expect(normalizeValue('["a", "b"]')).toEqual(["a", "b"]);
	});

	it("should parse valid JSON objects", () => {
		expect(normalizeValue('{"key": "value"}')).toEqual({ key: "value" });
	});

	it("should return non-JSON strings as-is", () => {
		expect(normalizeValue("hello world")).toBe("hello world");
		expect(normalizeValue("123")).toBe("123");
		expect(normalizeValue("true")).toBe("true");
	});

	it("should handle invalid JSON gracefully", () => {
		expect(normalizeValue("[invalid")).toBe("[invalid");
		expect(normalizeValue("{missing quotes}")).toBe("{missing quotes}");
	});

	it("should handle strings that look like JSON but aren't", () => {
		// String starting with [ but not ending with ]
		expect(normalizeValue("[hello")).toBe("[hello");
		// String starting with { but not ending with }
		expect(normalizeValue("{hello")).toBe("{hello");
	});
});

describe("assignFlat", () => {
	it("should assign non-empty values", () => {
		const target: Record<string, unknown> = {};
		assignFlat(target, { title: "My Blog", count: 0, enabled: true });
		expect(target).toEqual({ title: "My Blog", count: 0, enabled: true });
	});

	it("should skip empty strings", () => {
		const target: Record<string, unknown> = { existing: "value" };
		assignFlat(target, { title: "", description: null });
		// Empty string and null should NOT override existing values
		expect(target).toEqual({ existing: "value" });
	});

	it("should skip null values", () => {
		const target: Record<string, unknown> = { title: "Original" };
		assignFlat(target, { title: null });
		expect(target).toEqual({ title: "Original" });
	});

	it("should overwrite with valid values", () => {
		const target: Record<string, unknown> = { title: "Old" };
		assignFlat(target, { title: "New" });
		expect(target).toEqual({ title: "New" });
	});
});

describe("mergeSettings", () => {
	const defaults = {
		basic: {
			title: "Firefly",
			subtitle: "Demo site",
			hue: 165,
		},
		theme: {
			mode: "banner",
			playerEnable: true,
		},
	};

	it("should use defaults when no DB settings", () => {
		const result = mergeSettings(defaults, {});
		expect(result.basic).toEqual({ title: "Firefly", subtitle: "Demo site", hue: 165 });
		expect(result.theme).toEqual({ mode: "banner", playerEnable: true });
	});

	it("should override defaults with DB settings", () => {
		const dbSettings = {
			basic: { title: "My Custom Blog", hue: 200 },
		};
		const result = mergeSettings(defaults, dbSettings);
		expect(result.basic?.title).toBe("My Custom Blog");
		expect(result.basic?.hue).toBe(200);
		expect(result.basic?.subtitle).toBe("Demo site"); // unchanged
	});

	it("should not let empty strings override defaults", () => {
		const dbSettings = {
			basic: { title: "" },
		};
		const result = mergeSettings(defaults, dbSettings);
		// Empty string should not override
		expect(result.title).toBe("Firefly");
	});

	it("should parse JSON strings from DB", () => {
		const dbSettings = {
			nav: {
				navItems: '[{"name":"Home","url":"/"}]',
			},
		};
		const result = mergeSettings({}, dbSettings);
		expect(result.nav?.navItems).toEqual([{ name: "Home", url: "/" }]);
	});

	it("should merge nested groups correctly", () => {
		const dbSettings = {
			basic: { title: "Updated" },
			theme: { mode: "gradient" },
		};
		const result = mergeSettings(defaults, dbSettings);
		expect(result.basic?.title).toBe("Updated");
		expect(result.theme?.mode).toBe("gradient");
		expect(result.theme?.playerEnable).toBe(true); // default preserved
	});
});

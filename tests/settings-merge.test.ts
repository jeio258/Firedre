import { describe, it, expect } from "vitest";
import {
	mergeSettings,
	normalizeSettingValue,
} from "../server/settings/merge";

describe("normalizeSettingValue", () => {
	it("should parse valid JSON arrays", () => {
		expect(normalizeSettingValue('["a", "b"]')).toEqual(["a", "b"]);
	});

	it("should parse valid JSON objects", () => {
		expect(normalizeSettingValue('{"key": "value"}')).toEqual({ key: "value" });
	});

	it("should return non-JSON strings as-is", () => {
		expect(normalizeSettingValue("hello world")).toBe("hello world");
		expect(normalizeSettingValue("123")).toBe("123");
		expect(normalizeSettingValue("true")).toBe("true");
	});

	it("should handle invalid JSON gracefully", () => {
		expect(normalizeSettingValue("[invalid")).toBe("[invalid");
		expect(normalizeSettingValue("{missing quotes}")).toBe("{missing quotes}");
	});
});

describe("mergeSettings（middleware 真实合并逻辑）", () => {
	const groupNames = new Set<string>(["basic", "theme", "nav"]);

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
		const result = mergeSettings(defaults, {}, groupNames) as Record<
			string,
			Record<string, unknown>
		>;
		expect(result.basic).toEqual({
			title: "Firefly",
			subtitle: "Demo site",
			hue: 165,
		});
		expect(result.theme).toEqual({ mode: "banner", playerEnable: true });
	});

	it("should override defaults with DB settings", () => {
		const db = { basic: { title: "My Custom Blog", hue: 200 } };
		const result = mergeSettings(defaults, db, groupNames) as Record<
			string,
			Record<string, unknown>
		>;
		expect(result.basic?.title).toBe("My Custom Blog");
		expect(result.basic?.hue).toBe(200);
		expect(result.basic?.subtitle).toBe("Demo site"); // unchanged
	});

	it("should not let empty strings override defaults (flat)", () => {
		const db = { basic: { title: "" } };
		const result = mergeSettings(defaults, db, groupNames) as Record<
			string,
			unknown
		>;
		expect(result.title).toBe("Firefly");
	});

	it("should parse JSON strings from DB", () => {
		const db = { nav: { navItems: '[{"name":"Home","url":"/"}]' } };
		const result = mergeSettings({}, db, groupNames) as Record<
			string,
			Record<string, unknown>
		>;
		expect(result.nav?.navItems).toEqual([{ name: "Home", url: "/" }]);
	});

	it("should merge nested groups correctly", () => {
		const db = {
			basic: { title: "Updated" },
			theme: { mode: "gradient" },
		};
		const result = mergeSettings(defaults, db, groupNames) as Record<
			string,
			Record<string, unknown>
		>;
		expect(result.basic?.title).toBe("Updated");
		expect(result.theme?.mode).toBe("gradient");
		expect(result.theme?.playerEnable).toBe(true); // default preserved
	});

	it("should skip DB keys that collide with group names (flat pollution)", () => {
		const db = { basic: { theme: "hacked", title: "ok" } };
		const result = mergeSettings(defaults, db, groupNames) as Record<
			string,
			unknown
		>;
		expect(result.theme).toEqual({ mode: "banner", playerEnable: true });
		expect(result.title).toBe("ok");
	});

	it("should skip keys defined in multiple default groups (conflicted flat keys)", () => {
		const conflicting = {
			alpha: { shared: "a", onlyA: 1 },
			beta: { shared: "b" },
		};
		const db = { alpha: { shared: "from-db" } };
		const result = mergeSettings(conflicting, db, new Set(["alpha", "beta"]));
		expect(result.shared).toBeUndefined();
	});
});

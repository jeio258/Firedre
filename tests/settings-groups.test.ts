import { describe, it, expect } from "vitest";
import { SETTING_GROUPS } from "../server/settings/service";
import { flattenSettingsDefaults } from "../server/settings/flatten";

const REMOVED_DEAD_GROUPS = ["widgets", "expressive", "encrypt", "plantuml"];

describe("SETTING_GROUPS 已清除死配置组", () => {
	it("四个死组（widgets/expressive/encrypt/plantuml）不再出现", () => {
		for (const g of REMOVED_DEAD_GROUPS) {
			expect(SETTING_GROUPS).not.toContain(g);
		}
	});

	it("flatten 默认值不含死组、也不含孤儿默认值（与 SETTING_GROUPS 无漂移）", () => {
		const defaults = flattenSettingsDefaults();
		// 死组已从默认值映射中彻底移除
		for (const g of REMOVED_DEAD_GROUPS) {
			expect(defaults[g]).toBeUndefined();
		}
		// 默认值映射的组名不应超出 SETTING_GROUPS（避免孤儿默认值残留）
		for (const key of Object.keys(defaults)) {
			expect(SETTING_GROUPS).toContain(key as never);
		}
	});
});

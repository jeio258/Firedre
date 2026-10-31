import { describe, expect, it } from "vitest";
import { flattenSettingsDefaults } from "../server/settings/flatten";

// 黄金快照：以旧实现 seed 一次后，重构不得改变任何字段名或值，
// 否则说明 flatten 输出契约（后台表单字段）发生漂移。
describe("flattenSettingsDefaults 输出契约稳定性", () => {
	it("输出与历史快照逐字节一致", () => {
		expect(flattenSettingsDefaults()).toMatchSnapshot();
	});
});

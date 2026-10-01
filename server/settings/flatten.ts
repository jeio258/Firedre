import { settingsDefaults } from "@shared/config/settings-defaults";

type AnyObj = Record<string, unknown>;
type FlatGroup = Record<string, unknown>;

/**
 * 运行时默认值真源（A2 单一默认源）：settingsDefaults 即表单扁平形状，
 * 直接浅拷贝投影，不再经由静态配置 getter 派生。
 * 输出多出的键（如 dynamic.profileUrl）为 defaults 既有字段，schema 驱动的表单不会渲染。
 */
export function flattenSettingsDefaults(): Record<string, FlatGroup> {
	const defaults = settingsDefaults as unknown as Record<string, AnyObj>;
	const out: Record<string, FlatGroup> = {};
	for (const group of Object.keys(defaults)) {
		out[group] = { ...defaults[group] };
	}
	return out;
}

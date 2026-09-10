export type SettingsGroups = Record<string, Record<string, unknown>>;

export function normalizeSettingValue(v: unknown): unknown {
	if (typeof v === "string") {
		const t = v.trim();
		const looksJson =
			(t.startsWith("[") && t.endsWith("]")) ||
			(t.startsWith("{") && t.endsWith("}"));
		if (looksJson) {
			try {
				return JSON.parse(t);
			} catch {
				return v;
			}
		}
	}
	return v;
}

/** 默认值铺底（嵌套组 + 平铺标量），数据库组值覆盖其上 */
export function mergeSettings(
	defaults: SettingsGroups,
	dbGroups: SettingsGroups,
	groupNames: Set<string>,
): Record<string, unknown> {
	const merged: Record<string, unknown> = {};

	const fieldGroupCount = new Map<string, number>();
	for (const group of Object.values(defaults)) {
		for (const k of Object.keys(group ?? {})) {
			fieldGroupCount.set(k, (fieldGroupCount.get(k) ?? 0) + 1);
		}
	}
	const conflictedKeys = new Set<string>();
	for (const [k, n] of fieldGroupCount) if (n > 1) conflictedKeys.add(k);

	const assignFlat = (
		target: Record<string, unknown>,
		g: Record<string, unknown>,
	) => {
		for (const [k, v] of Object.entries(g)) {
			if (groupNames.has(k)) continue;
			if (conflictedKeys.has(k)) continue;
			if (v === "" || v == null) continue;
			target[k] = v;
		}
	};

	for (const [groupKey, group] of Object.entries(defaults)) {
		const g: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(group ?? {})) {
			g[k] = normalizeSettingValue(v);
		}
		merged[groupKey] = g;
		assignFlat(merged, g);
	}

	for (const [groupKey, group] of Object.entries(dbGroups)) {
		const g: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(group ?? {})) {
			g[k] = normalizeSettingValue(v);
		}
		merged[groupKey] = {
			...((merged[groupKey] as SettingsGroups | undefined) ?? {}),
			...g,
		};
		assignFlat(merged, g);
	}

	return merged;
}

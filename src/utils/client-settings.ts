import { settingsDefaults } from "../config/settings-defaults";
import { redactSensitive } from "../../server/settings/sensitive";

const CLIENT_SETTING_GROUPS = [
	"basic",
	"theme",
	"panel",
	"effects",
	"mermaid",
] as const;

const clientFlatKeys = new Set<string>();
for (const group of CLIENT_SETTING_GROUPS) {
	const fields = (settingsDefaults as Record<string, Record<string, unknown>>)[
		group
	];
	for (const key of Object.keys(fields ?? {})) clientFlatKeys.add(key);
}

export function toClientSettings(merged: unknown) {
	const source = (merged ?? {}) as Record<string, unknown>;
	const out: Record<string, unknown> = {};

	for (const group of CLIENT_SETTING_GROUPS) {
		out[group] = { ...((source[group] as Record<string, unknown>) ?? {}) };
	}

	for (const key of clientFlatKeys) {
		if (key in source) out[key] = source[key];
	}

	return redactSensitive(out);
}

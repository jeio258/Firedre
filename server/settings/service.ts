import type { CloudflareEnv } from "../../types/env";

export const SETTING_GROUPS = [
	"basic",
	"panel",
	"profile",
	"theme",
	"nav",
	"sidebar",
	"font",
	"comment",
	"cover",
	"music",
	"mermaid",
	"dynamic",
	"friends",
	"gallery",
	"bilibili",
	"sponsor",
	"vndb",
	"myanimelist",
	"bangumi",
	"bookmarks",
	"effects",
	"announcement",
	"footer",
	"ads",
	"license",
	"pio",
	"analytics",
] as const;
export type SettingGroup = (typeof SETTING_GROUPS)[number];

export type SettingsMap = Partial<
	Record<SettingGroup, Record<string, unknown>>
>;

const LEGACY_KEYS: Record<string, SettingGroup> = {
	site: "basic",
	"": "basic",
};

async function readAllFromD1(env: CloudflareEnv): Promise<SettingsMap> {
	const rows = await env.DB.prepare(
		"SELECT key, value FROM site_settings",
	).all<{ key: string; value: string }>();
	const out: SettingsMap = {};
	for (const row of rows.results ?? []) {
		if (row.key.startsWith("__firedre_")) continue;
		const group = groupOfKey(row.key);
		try {
			out[group] = { ...(out[group] ?? {}), ...JSON.parse(row.value) };
		} catch {

		}
	}
	return out;
}

const VERSION_KEY = "__firedre_settings_version";

export async function getSettingsVersion(env: CloudflareEnv): Promise<string> {
	try {
		const row = await env.DB.prepare(
			"SELECT value FROM site_settings WHERE key = ?",
		)
			.bind(VERSION_KEY)
			.first<{ value: string }>();
		return row?.value || "0";
	} catch {

	}
	return "0";
}

async function bumpSettingsVersion(env: CloudflareEnv): Promise<void> {
	try {

		await env.DB.prepare(`
			INSERT INTO site_settings (key, value, updated_at)
			VALUES (?, '1', datetime('now'))
			ON CONFLICT(key) DO UPDATE SET
				value = CAST(value AS INTEGER) + 1,
				updated_at = datetime('now')
		`)
			.bind(VERSION_KEY)
			.run();
	} catch {

	}
}

function groupOfKey(key: string): SettingGroup {
	return (
		LEGACY_KEYS[key] ??
		(SETTING_GROUPS.includes(key as SettingGroup)
			? (key as SettingGroup)
			: "basic")
	);
}

export async function getAllSettings(env: CloudflareEnv): Promise<SettingsMap> {
	return readAllFromD1(env);
}

export async function getSettingsGroup(
	env: CloudflareEnv,
	group: SettingGroup,
): Promise<Record<string, unknown>> {
	const row = await env.DB.prepare(
		"SELECT value FROM site_settings WHERE key = ?",
	)
		.bind(group)
		.first<{ value: string }>();
	if (!row) return {};
	try {
		return JSON.parse(row.value) as Record<string, unknown>;
	} catch {
		return {};
	}
}

export async function saveSettingsGroups(
	env: CloudflareEnv,
	groups: Partial<Record<SettingGroup, Record<string, unknown>>>,
): Promise<void> {
	const entries = Object.entries(groups) as [SettingGroup, Record<string, unknown>][];
	if (entries.length === 0) return;

	const sql = `
		INSERT INTO site_settings (key, value, updated_at)
		VALUES (?, ?, datetime('now'))
		ON CONFLICT(key) DO UPDATE SET
			value = excluded.value,
			updated_at = datetime('now')
	`;

	const db = env.DB as unknown as {
		batch?: (stmts: { run(): Promise<unknown> }[]) => Promise<unknown>;
		prepare(sql: string): {
			bind(...args: unknown[]): { run(): Promise<unknown> };
		};
	};
	if (typeof db.batch === "function") {
		await db.batch(
			entries.map(([group, data]) =>
				db.prepare(sql).bind(group, JSON.stringify(data)),
			),
		);
	} else {
		// 本地 dev 垫片：无 batch()，逐组写（KV 全量同步仍只做一次）
		for (const [group, data] of entries) {
			await db.prepare(sql).bind(group, JSON.stringify(data)).run();
		}
	}

	await bumpSettingsVersion(env);
}

export async function saveSettingsGroup(
	env: CloudflareEnv,
	group: SettingGroup,
	data: Record<string, unknown>,
): Promise<void> {
	await saveSettingsGroups(env, { [group]: data });
}

export interface SiteSettings {
	title?: string;
	description?: string;
	siteUrl?: string;
	author?: string;
	avatar?: string;
	hue?: number;
	bannerUrl?: string;
	footerText?: string;
	icp?: string;
	commentEnabled?: boolean;
	navItems?: Array<{ label: string; url: string }>;
	social?: Array<{ label: string; url: string }>;
}

export interface SettingsShape {
	title?: string;
	description?: string;
	siteUrl?: string;
	author?: string;
	avatar?: string;
	hue?: number;
	bannerUrl?: string;
	icp?: string;
	navItems?: Array<{ label: string; url: string }>;
	social?: Array<{ label: string; url: string }>;
	music?: { enabled?: boolean; url?: string; name?: string };
	effects?: {
		sakura?: boolean;
		waves?: boolean;
		gradient?: boolean;
	};
	pio?: { enabled?: boolean };
	comment?: { enabled?: boolean; type?: string };
	license?: { enabled?: boolean; type?: string; url?: string };
	announcement?: { enabled?: boolean; content?: string };
	analytics?: { googleAnalyticsId?: string; microsoftClarityId?: string; umamiId?: string; umamiUrl?: string };
	ads?: { enabled?: boolean; adSenseId?: string; customCode?: string };
	keywords?: string;
	defaultMode?: string;
	pageWidth?: number;
	categoryBar?: boolean;
	categoryStyle?: string;
	tagStyle?: string;
	cardBorder?: boolean;
	faviconUrl?: string;
	siteStartDate?: string;
}

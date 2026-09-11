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
	"plantuml",
	"expressiveCode",
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
		} catch (e) {
			console.warn("[settings] 设置值 JSON 解析失败 key=" + row.key, e);
		}
	}
	return out;
}

const VERSION_KEY = "__firedre_settings_version";
const VERSION_CACHE_TTL_MS = 3000;
const versionCacheScope = globalThis as {
	__FIREDRE_VER_CACHE__?: { value: string; at: number };
};

export async function getSettingsVersion(env: CloudflareEnv): Promise<string> {
	try {
		const row = await env.DB.prepare(
			"SELECT value FROM site_settings WHERE key = ?",
		)
			.bind(VERSION_KEY)
			.first<{ value: string }>();
		return row?.value || "0";
	} catch (e) {
		console.warn("[settings] 配置版本读取失败", e);
	}
	return "0";
}

export async function getSettingsVersionCached(
	env: CloudflareEnv,
): Promise<string> {
	const cached = versionCacheScope.__FIREDRE_VER_CACHE__;
	if (cached && Date.now() - cached.at < VERSION_CACHE_TTL_MS)
		return cached.value;
	const value = await getSettingsVersion(env);
	versionCacheScope.__FIREDRE_VER_CACHE__ = { value, at: Date.now() };
	return value;
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
	} catch (e) {
		console.warn("[settings] 配置版本自增失败", e);
	}
}

export async function bumpContentVersion(env: CloudflareEnv): Promise<void> {
	await bumpSettingsVersion(env);
	versionCacheScope.__FIREDRE_VER_CACHE__ = undefined;
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

	// 合并下沉到 SQL：json_patch 递归合并现有值与传入值，避免部分更新清空同组其余字段（含嵌套子字段/跨编辑器保全），且原子无额外读
	const sql = `
		INSERT INTO site_settings (key, value, updated_at)
		VALUES (?, json(?), datetime('now'))
		ON CONFLICT(key) DO UPDATE SET
			value = json_patch(value, ?),
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
			entries.map(([group, data]) => {
				const payload = JSON.stringify(data);
				return db.prepare(sql).bind(group, payload, payload);
			}),
		);
	} else {
		// 本地 dev 垫片：无 batch()，逐组写（KV 全量同步仍只做一次）
		for (const [group, data] of entries) {
			const payload = JSON.stringify(data);
			await db.prepare(sql).bind(group, payload, payload).run();
		}
	}

	await bumpContentVersion(env);
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

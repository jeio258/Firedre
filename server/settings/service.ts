import type { CloudflareEnv } from "../../types/env";

/** 配置分组（对应 Firefly src/config/*.ts 与后台站点设置菜单） */
export const SETTING_GROUPS = [
	"basic",
	"panel",
	"profile",
	"theme",
	"nav",
	"sidebar",
	"widgets",
	"font",
	"expressive",
	"comment",
	"cover",
	"encrypt",
	"music",
	"mermaid",
	"plantuml",
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

// ── KV 缓存（用户要求配置存 KV）：读写全量配置快照 ──
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
			/* ignore */
		}
	}
	return out;
}

// 配置版本号（D1 强一致）：HTML 缓存 key 依赖它 → 配置变更即时使旧缓存失效。
// 不能用 KV 存版本号（KV 最终一致性：写后立即读可能旧值 → 缓存不失效 → 配置"不生效"）。
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
		/* ignore */
	}
	return "0";
}

async function bumpSettingsVersion(env: CloudflareEnv): Promise<void> {
	try {
		// 原子自增：单条 UPSERT 内用 CAST(value)+1，避免并发保存时先读后写丢版本号
		// （若两次并发保存读到同一 cur，原实现会只 +1，导致 HTML 缓存 key 不随第二次失效）。
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
		/* ignore */
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

/**
 * 读取全部配置组。
 * 读以 D1 为准（SQLite 强一致 → 配置修改即时生效）；
 * KV 作为镜像存储（保存时同步写入），不参与读路径，
 * 避免 KV 最终一致性导致边缘节点返回旧快照（"保存不生效"）。
 */
export async function getAllSettings(env: CloudflareEnv): Promise<SettingsMap> {
	return readAllFromD1(env);
}

/** 读取单组 */
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

/**
 * 批量保存多组（D1 持久化 + KV 缓存同步 + 版本 bump）。
 *
 * 相比逐组调用 saveSettingsGroup，此处把 N 组保存聚合为：
 *   1 次 D1 批量写入 + 1 次版本 bump，避免逐组全量重读重写导致耗时随组数恶化。
 * 读路径一律以 D1 为准（强一致），无 KV 镜像（原镜像只写不读，属死代码已移除）。
 */
export async function saveSettingsGroups(
	env: CloudflareEnv,
	groups: Record<SettingGroup, Record<string, unknown>>,
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

	// D1 batch（生产）：1 次原子写入全部组。本地 dev 垫片无 batch() 时逐组 run()。
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

	// 版本 bump（一次）：配置版本号变更使 HTML 缓存 key 失效，配置即时生效
	await bumpSettingsVersion(env);
}

/** 保存整组（D1 持久化 + KV 缓存同步） */
export async function saveSettingsGroup(
	env: CloudflareEnv,
	group: SettingGroup,
	data: Record<string, unknown>,
): Promise<void> {
	await saveSettingsGroups(env, { [group]: data });
}

/** 兼容旧接口：读扁平 SiteSettings（basic 组），仅供 middleware 类型标注 */
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

/** 前台覆盖用的扁平设置形状 */
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

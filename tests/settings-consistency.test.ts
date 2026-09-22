import { describe, expect, it } from "vitest";
import { flattenSettingsDefaults } from "../server/settings/flatten";
import { SETTING_GROUPS } from "../server/settings/service";
import { settingsDefaults } from "../shared/config/settings-defaults";
import { GROUPS } from "../src/components/admin/adminSettingsSchema/index";

/**
 * 设置链路一致性护栏（防"后台加了组/字段但链路漏同步→静默失效"）：
 * admin 表单(schema) → settingsDefaults(seed) → flatten(GET 默认值) → SETTING_GROUPS(入库白名单)。
 * 已核实：GET 读取路径为 { ...flattenDefaults[group], ...db[group] }，flatten 即运行时默认值真源。
 *
 * 字段级仅做"不得新增分歧"护栏：下列两处分歧是既有设计（多数字段无静态默认、
 * SCHEMA 组默认值来自静态 getter 而非 settingsDefaults），修改链路时必须显式增删此表。
 */
const KNOWN_SCHEMA_NO_DEFAULT = new Set([
	// schema 有、flatten 无静态默认（保存进 D1 后生效，属设计）
	"basic.faviconUrl",
	"sidebar.showProfile",
	"sidebar.showAnnouncement",
	"sidebar.showMusic",
	"sidebar.showCategories",
	"sidebar.showTags",
	"sidebar.showCalendar",
	"font.enable",
	"font.bannerTitleFont",
	"font.bannerSubtitleFont",
	"font.navbarTitleFont",
	"font.codeFont",
	"cover.showLoading",
	"cover.enableInPost",
	"cover.enableInPostOverlay",
	"cover.randomCoverImage",
	"music.enabled",
	"music.autoplay",
	"music.sourceScript",
	"sponsor.title",
	"sponsor.description",
	"sponsor.showButtonInPost",
	"sponsor.showSponsorsList",
	"pio.type",
	"pio.model",
]);

const KNOWN_FLATTEN_NO_DEFAULT = new Set([
	// flatten 有、settingsDefaults 无（默认值来自静态 getter，seed 仅 PASSTHROUGH 组使用）
	"basic.cardBorder",
	"basic.cardFollowTheme",
	"basic.cardRadius",
	"profile.location",
	"profile.email",
	"comment.enabled",
	"comment.artalkSiteName",
	"footer.text",
	"footer.icp",
	"footer.startYear",
	"footer.customHtml",
	"pio.opacity",
	"license.type",
	"sponsor.enabled",
	"sponsor.qrCode",
	"dynamic.memosEnable",
	"dynamic.memosApiUrl",
	"announcement.enabled",
	"announcement.sections",
	"nav.social",
	"cover.enable",
	"cover.defaultImage",
	"cover.configurable",
	"font.scale",
	"mermaid.lightTheme",
	"mermaid.darkTheme",
	"analytics.googleAnalyticsId",
	"analytics.microsoftClarityId",
	"analytics.umamiId",
	"analytics.umamiUrl",
]);

describe("设置链路一致性（admin 表单 → defaults → flatten → SETTING_GROUPS）", () => {
	const flatten = flattenSettingsDefaults();
	const schemaGroups = GROUPS.map((g) => g.key);
	const defaultGroups = Object.keys(settingsDefaults);
	const flattenGroups = Object.keys(flatten);

	it("admin 表单每个组都在 flatten 默认值中（加组必同步 flatten，防 GET 返回空）", () => {
		const missing = schemaGroups.filter((g) => !flattenGroups.includes(g));
		expect(missing).toEqual([]);
	});

	it("admin 表单每个组都在 SETTING_GROUPS 白名单中（加组必同步入库白名单）", () => {
		const missing = schemaGroups.filter(
			(g) => !SETTING_GROUPS.includes(g as never),
		);
		expect(missing).toEqual([]);
	});

	it("settingsDefaults 每个组都在 flatten 默认值中（加默认值必同步 flatten）", () => {
		const missing = defaultGroups.filter((g) => !flattenGroups.includes(g));
		expect(missing).toEqual([]);
	});

	it("新增的 schema 字段必须同步 flatten 或显式登记（不得新增静默分歧）", () => {
		const actual = new Set<string>();
		for (const g of GROUPS) {
			const flatFields = Object.keys(flatten[g.key] ?? {});
			for (const f of g.fields) {
				if (f.hidden || f.type === "password") continue;
				if (!flatFields.includes(f.name)) actual.add(`${g.key}.${f.name}`);
			}
		}
		const unexpected = [...actual].filter(
			(k) => !KNOWN_SCHEMA_NO_DEFAULT.has(k),
		);
		expect(unexpected).toEqual([]);
	});

	it("新增的 flatten 字段必须同步 settingsDefaults 或显式登记", () => {
		const actual = new Set<string>();
		for (const g of flattenGroups) {
			const defFields = Object.keys(
				(settingsDefaults as Record<string, object>)[g] ?? {},
			);
			for (const f of Object.keys(flatten[g])) {
				if (!defFields.includes(f)) actual.add(`${g}.${f}`);
			}
		}
		const unexpected = [...actual].filter(
			(k) => !KNOWN_FLATTEN_NO_DEFAULT.has(k),
		);
		expect(unexpected).toEqual([]);
	});
});

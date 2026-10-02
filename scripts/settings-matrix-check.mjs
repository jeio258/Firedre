#!/usr/bin/env node
// settings 四件套门禁：defaults ↔ SETTING_GROUPS ↔ admin schema 字段矩阵一致性
// 规则：schema 字段必须 ⊆ defaults（否则表单渲染 undefined）；defaults-only 字段必须命中结构白名单；
//      组集合三方一致；无表单组必须命中专属编辑器白名单。任一违反即退出 1。
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildSync } from "esbuild";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

const ENTRY = `
import { settingsDefaults } from "@shared/config/settings-defaults";
import { SETTING_GROUPS } from "@server/settings/service";
import { GROUPS } from "@components/admin/adminSettingsSchema";
const groups = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Object.keys(v)]));
module.exports = {
  defaults: groups(settingsDefaults),
  service: SETTING_GROUPS,
  schema: Object.fromEntries(GROUPS.map((g) => [g.key, g.fields.map((f) => f.name)])),
};
`;

// 白名单：无表单组由专属编辑器管理；结构字段为 getter 模板（A4），不应进表单
const DEDICATED_EDITOR_GROUPS = new Set([
	"announcement", // AdminNoticeEditor
	"dynamic", // AdminDynamic
	"friends", // AdminFriendsEditor
	"gallery", // AdminGalleryHub
]);
const STRUCTURAL_FIELDS = {
	basic: [
		"bangumi",
		"bilibili",
		"favicon",
		"foldArticle",
		"imageOptimization",
		"lang",
		"mal",
		"navbar",
		"pagination",
		"postListLayout",
		"vndb",
	],
	bangumi: ["mode"],
	vndb: ["mode"],
	nav: ["navItems", "social"],
	panel: ["overlaySwitchable"],
	post: [
		"generateOgImages",
		"outdatedThreshold",
		"rehypeCallouts",
		"showLastModified",
	],
	sidebar: [
		"enable",
		"leftComponents",
		"mobileBottomComponents",
		"position",
		"rightComponents",
		"tabletSidebar",
	],
	theme: ["wallpaperBase"],
};

const dir = mkdtempSync(join(tmpdir(), "firedre-matrix-"));
const entryPath = join(dir, "entry.ts");
const outPath = join(dir, "out.cjs");
try {
	writeFileSync(entryPath, ENTRY);
	buildSync({
		entryPoints: [entryPath],
		outfile: outPath,
		bundle: true,
		platform: "node",
		format: "cjs",
		alias: {
			"@shared": join(ROOT, "shared"),
			"@components": join(ROOT, "src/components"),
			"@server": join(ROOT, "server"),
		},
		logLevel: "silent",
	});
	const mod = await import(pathToFileURL(outPath).href);
	const { defaults, service, schema } = mod.default;
	const errors = [];

	const dKeys = Object.keys(defaults).sort();
	const svSet = new Set(service);
	for (const k of dKeys)
		if (!svSet.has(k))
			errors.push(`组 [${k}] 存在于 defaults 但不在 SETTING_GROUPS`);
	for (const k of svSet)
		if (!(k in defaults))
			errors.push(`组 [${k}] 存在于 SETTING_GROUPS 但不在 defaults`);

	for (const k of Object.keys(schema)) {
		if (!(k in defaults))
			errors.push(`组 [${k}] 存在于 schema 但不在 defaults（表单保存无落点）`);
	}
	for (const k of dKeys) {
		if (!(k in schema) && !DEDICATED_EDITOR_GROUPS.has(k))
			errors.push(`组 [${k}] 无表单且不在专属编辑器白名单`);
	}

	for (const [g, fields] of Object.entries(schema)) {
		const dd = new Set(defaults[g] ?? []);
		for (const f of fields)
			if (!dd.has(f))
				errors.push(
					`字段 [${g}.${f}] 存在于 schema 但不在 defaults（表单将渲染 undefined）`,
				);
	}

	for (const [g, fields] of Object.entries(defaults)) {
		if (DEDICATED_EDITOR_GROUPS.has(g)) continue; // 专属编辑器组不走 schema 表单，整体豁免
		const ss = new Set(schema[g] ?? []);
		const allow = new Set(STRUCTURAL_FIELDS[g] ?? []);
		for (const f of fields)
			if (!ss.has(f) && !allow.has(f))
				errors.push(
					`字段 [${g}.${f}] 存在于 defaults 但表单不可配置且不在结构白名单`,
				);
	}

	if (errors.length) {
		console.error("[settings-matrix] ✗ 字段矩阵门禁失败：");
		for (const e of errors) console.error(`  - ${e}`);
		process.exitCode = 1;
	} else {
		console.log(
			`[settings-matrix] ✓ 字段矩阵一致（defaults ${dKeys.length} 组 / schema ${Object.keys(schema).length} 组）`,
		);
	}
} finally {
	rmSync(dir, { recursive: true, force: true });
}

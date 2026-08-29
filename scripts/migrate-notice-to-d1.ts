#!/usr/bin/env node
/**
 * 将公告配置（src/config/announcementConfig.ts）写入 D1 notice_board
 *
 * 用法:
 *   pnpm migrate:notice / pnpm migrate:notice:local
 */

import { isLocal, runWranglerSql, sqlValue } from "./migrate-utils";

async function loadAnnouncementConfig() {
	const mod = await import("../src/config/announcementConfig.ts");
	return mod.announcementConfig as {
		title?: string;
		content?: string;
		closable?: boolean;
		link?: { enable?: boolean; text?: string; url?: string };
	};
}

const cfg = await loadAnnouncementConfig();

const sections = [
	{
		label: "公告",
		lines: [
			{ text: cfg.content || "欢迎来到我的博客！" },
			...(cfg.link?.enable && cfg.link.text
				? [{ text: `${cfg.link.text}：${cfg.link.url || ""}` }]
				: []),
		],
	},
];

const title = cfg.title || "公告栏";
const sectionsJson = JSON.stringify(sections);

const sql = `
  INSERT INTO notice_board (id, title, sections_json, updated_at)
  VALUES (1, ${sqlValue(title)}, ${sqlValue(sectionsJson)}, datetime('now'))
  ON CONFLICT(id) DO UPDATE SET
    title = excluded.title,
    sections_json = excluded.sections_json,
    updated_at = datetime('now');
`;

runWranglerSql(sql);
console.log(`已迁移公告栏（${sections.length} 个区块）`);

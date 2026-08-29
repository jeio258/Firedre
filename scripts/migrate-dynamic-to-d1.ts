#!/usr/bin/env node
/**
 * 将本地动态（src/content/dynamic/*.md）迁移到 D1 dynamics 表
 *
 * 用法:
 *   pnpm migrate:dynamic / pnpm migrate:dynamic:local
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
	dynamicSearchText,
	extractDynamicImages,
} from "../server/dynamic/plain";
import { splitMarkdown } from "../server/posts/frontmatter";
import { isLocal, runWranglerSql, sqlValue } from "./migrate-utils";

const root = process.cwd();
const dynDir = join(root, "src", "content", "dynamic");

const files = readdirSync(dynDir).filter((name) => name.endsWith(".md"));
if (!files.length) {
	console.log("没有可迁移的动态条目。");
	process.exit(0);
}

console.log(
	`准备迁移 ${files.length} 条动态 (${isLocal() ? "local" : "remote"})...`,
);

for (const file of files) {
	const id = file.replace(/\.md$/i, "");
	const source = readFileSync(join(dynDir, file), "utf8");
	const { frontmatter, content } = splitMarkdown(source);

	const publishedRaw = frontmatter.published
		? Date.parse(String(frontmatter.published))
		: Date.now();
	const published = Number.isFinite(publishedRaw) ? publishedRaw : Date.now();
	const pinned = frontmatter.pinned === true ? 1 : 0;
	const location = String(frontmatter.location || "");
	const searchText = dynamicSearchText(content, location);

	const sql = `
    INSERT INTO dynamics (id, content, images, published, pinned, location, search_text, updated_at)
    VALUES (
      ${sqlValue(id)}, ${sqlValue(content)}, ${sqlValue(JSON.stringify(extractDynamicImages(content)))},
      ${published}, ${pinned}, ${sqlValue(location)}, ${sqlValue(searchText)}, datetime('now')
    )
    ON CONFLICT(id) DO UPDATE SET
      content = excluded.content, images = excluded.images, published = excluded.published,
      pinned = excluded.pinned, location = excluded.location, search_text = excluded.search_text,
      updated_at = datetime('now');
  `;

	runWranglerSql(sql);
	console.log(`已迁移: ${id}`);
}

console.log("\n动态迁移完成。");

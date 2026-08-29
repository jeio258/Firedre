#!/usr/bin/env node
/**
 * 将本地文章迁移到 R2 + D1（含 FTS 索引与分类/标签）
 *
 * 用法:
 *   pnpm migrate:posts            # 迁移到远端（生产）
 *   pnpm migrate:posts:local      # 迁移到本地（wrangler dev）
 *
 * 数据源: src/content/posts 下全部 .md/.mdx（Firefly 静态内容）
 * 目标:   R2 posts/{slug}.md + D1 posts 表 + posts_fts + post_categories/post_tags
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { splitMarkdown } from "../server/posts/frontmatter";
import {
	countWords,
	estimateMinutes,
	firstParagraphText,
	stripMarkdown,
} from "../server/posts/markdown";
import {
	BUCKET_NAME,
	isLocal,
	remoteFlag,
	runWrangler,
	runWranglerSql,
	sqlValue,
} from "./migrate-utils";

const root = process.cwd();
// Firedre：内容集合已移除（ede9908），文章迁移到仓库根目录 posts/（.md/.mdx）
const postsDir = join(root, "posts");

function walk(dir: string): string[] {
	const out: string[] = [];
	for (const name of readdirSync(dir)) {
		const full = join(dir, name);
		if (statSync(full).isDirectory()) {
			out.push(...walk(full));
		} else if (name.endsWith(".md") || name.endsWith(".mdx")) {
			out.push(full);
		}
	}
	return out;
}

function slugFromPath(file: string) {
	const rel = relative(postsDir, file).replace(/\.(md|mdx)$/i, "");
	// guide/index.md → guide（与 Firefly URL 规则一致）
	return rel.replace(/\/index$/i, "");
}

const files = walk(postsDir);
if (!files.length) {
	console.log("没有可迁移的 Markdown 文章。");
	process.exit(0);
}

console.log(
	`准备迁移 ${files.length} 篇文章 (${isLocal() ? "local" : "remote"})...`,
);

for (const file of files) {
	const slug = slugFromPath(file);
	const source = readFileSync(file, "utf8");
	const { frontmatter, content } = splitMarkdown(source);
	const r2Key = `posts/${slug}.md`;

	// 封面：相对路径 → 上传 R2 covers/{slug}/{file} 并改写为可访问 URL
	const rawImage = frontmatter.image || frontmatter.cover;
	let coverValue = rawImage ? String(rawImage) : null;
	if (
		coverValue &&
		!/^(https?:)?\/\//.test(coverValue) &&
		!coverValue.startsWith("/api/")
	) {
		const imageRel = coverValue.replace(/^\.\//, "");
		const imagePath = join(dirname(file), imageRel);
		if (existsSync(imagePath) && statSync(imagePath).isFile()) {
			const imageName = basename(imagePath);
			runWrangler([
				"r2",
				"object",
				"put",
				`${BUCKET_NAME}/covers/${slug}/${imageName}`,
				"--file",
				imagePath,
				remoteFlag(),
			]);
			coverValue = `/api/covers/${slug}/${encodeURIComponent(imageName)}/`;
		} else {
			coverValue = null;
		}
	}

	runWrangler([
		"r2",
		"object",
		"put",
		`${BUCKET_NAME}/${r2Key}`,
		"--file",
		file,
		remoteFlag(),
	]);

	const title = String(frontmatter.title || slug);
	const date = String(
		frontmatter.published ||
			frontmatter.date ||
			new Date().toISOString().slice(0, 10),
	);
	const updated = frontmatter.updated ? String(frontmatter.updated) : null;
	const description = frontmatter.description || frontmatter.excerpt || "";
	const excerpt =
		frontmatter.excerpt ||
		frontmatter.description ||
		firstParagraphText(content) ||
		"";
	const cover = coverValue;
	const published =
		frontmatter.draft === true || frontmatter.hidden === true ? 0 : 1;
	const categories = frontmatter.category
		? JSON.stringify([String(frontmatter.category)])
		: Array.isArray(frontmatter.categories)
			? JSON.stringify(frontmatter.categories.map(String))
			: null;
	const tags = Array.isArray(frontmatter.tags)
		? JSON.stringify(frontmatter.tags.map(String))
		: frontmatter.tags
			? JSON.stringify([String(frontmatter.tags)])
			: null;
	const password = String(frontmatter.password || "");
	const pinOrder = (() => {
		const raw: unknown =
			frontmatter.pin_order ?? (frontmatter.pinned ? 1 : frontmatter.top);
		if (raw === undefined || raw === null || raw === "" || raw === false)
			return 0;
		if (raw === true) return 1;
		const n = Number(raw);
		return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
	})();
	const categoryPath = categories
		? (JSON.parse(categories) as string[]).join("/") || "Uncategorized"
		: "Uncategorized";
	const tagList = Array.isArray(frontmatter.tags)
		? frontmatter.tags.map(String)
		: frontmatter.tags
			? [String(frontmatter.tags)]
			: [];

	const words = countWords(content);
	const minutes = estimateMinutes(words);
	const plain = stripMarkdown(content);

	const sql = `
    INSERT INTO posts (slug, title, excerpt, description, date, updated, categories, tags, cover, pin_order, published, password, fm_json, words, minutes, r2_key, updated_at)
    VALUES (
      ${sqlValue(slug)}, ${sqlValue(title)}, ${sqlValue(excerpt)}, ${sqlValue(description)},
      ${sqlValue(date)}, ${sqlValue(updated)}, ${sqlValue(categories)}, ${sqlValue(tags)},
      ${sqlValue(cover)}, ${pinOrder}, ${published}, ${sqlValue(password)},
      ${sqlValue(JSON.stringify(frontmatter))}, ${words}, ${minutes}, ${sqlValue(r2Key)}, datetime('now')
    )
    ON CONFLICT(slug) DO UPDATE SET
      title = excluded.title, excerpt = excluded.excerpt, description = excluded.description,
      date = excluded.date, updated = excluded.updated, categories = excluded.categories,
      tags = excluded.tags, cover = excluded.cover, pin_order = excluded.pin_order,
      published = excluded.published, password = excluded.password, fm_json = excluded.fm_json,
      words = excluded.words, minutes = excluded.minutes, r2_key = excluded.r2_key,
      updated_at = datetime('now');
    DELETE FROM posts_fts WHERE slug = ${sqlValue(slug)};
    INSERT INTO posts_fts (slug, title, excerpt, content) VALUES (
      ${sqlValue(slug)}, ${sqlValue(title)}, ${sqlValue(excerpt || "")}, ${sqlValue(plain)}
    );
    DELETE FROM post_categories WHERE post_slug = ${sqlValue(slug)};
    DELETE FROM post_tags WHERE post_slug = ${sqlValue(slug)};
    INSERT INTO post_categories (post_slug, category_path) VALUES (${sqlValue(slug)}, ${sqlValue(categoryPath)});
    ${tagList.map((tag) => `INSERT INTO post_tags (post_slug, tag) VALUES (${sqlValue(slug)}, ${sqlValue(tag)});`).join("\n")}
  `;

	runWranglerSql(sql);
	console.log(`已迁移: ${slug}`);
}

console.log("\n文章迁移完成。");

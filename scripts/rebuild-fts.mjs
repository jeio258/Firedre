#!/usr/bin/env node
// 存量 posts_fts 核对/修复脚本。
//
// 为什么不能真正「重建」索引：FTS 的正文与摘要来自 R2 里的 Markdown 源文，
// 这里只连本地 D1，读不到 R2，所以重跑 upsertPost 不可行。脚本做两件确定能做的事：
//   1) 报告已发布、无口令、但 FTS 无行的文章 —— 这类只能靠后台重新保存文章触发 upsertPost；
//   2) 报告并（--fix）清空「有口令却仍在 FTS 里留有正文/摘要」的行 —— 这是口令保护漏口。
//
// 本地用法：
//   node scripts/rebuild-fts.mjs                 # 只报告
//   node scripts/rebuild-fts.mjs --fix           # 报告并清空越权泄漏的 FTS 正文/摘要
//   node scripts/rebuild-fts.mjs --db <path>     # 指定本地 D1 文件（默认 .wrangler/local-state/local-d1.sqlite）
//
// 生产用法（远端库，需要先 npx wrangler login；脚本自身不连远端，仅给出等价 SQL）：
//   # 1. 已发布、无口令、FTS 缺行
//   npx wrangler d1 execute firedre-blog --remote --command \
//     "SELECT p.slug FROM posts p LEFT JOIN posts_fts f ON f.slug = p.slug \
//      WHERE p.published = 1 AND (p.password IS NULL OR p.password = '') AND f.slug IS NULL"
//   # 2. 有口令但 FTS 仍留内容（把 <slug,...> 换成上一步查出的越权 slug）
//   npx wrangler d1 execute firedre-blog --remote --command \
//     "UPDATE posts_fts SET excerpt = '', content = '' WHERE slug IN ('<slug>', ...)"
//   # 3. 第 1 类文章没有 R2 正文就无法补索引：逐个进后台打开文章点保存（走 upsertPost）
//
// 退出码：0 = 无差异（或 --fix 已修完）；1 = 存在需要人工处理的差异；2 = 运行错误。

import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_DB = join(
	repoRoot,
	".wrangler",
	"local-state",
	"local-d1.sqlite",
);

function parseArgs(argv) {
	const out = {
		fix: false,
		db: process.env.D1_LOCAL_DB || DEFAULT_DB,
		help: false,
	};
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === "--fix") out.fix = true;
		else if (arg === "--db") {
			const value = argv[++i];
			if (!value) throw new Error("--db 需要跟一个文件路径");
			out.db = value;
		} else if (arg === "--help" || arg === "-h") out.help = true;
		else
			throw new Error(`未知参数：${arg}（可用：--fix / --db <path> / --help）`);
	}
	return out;
}

function tableExists(db, name) {
	const row = db
		.prepare(
			"SELECT 1 FROM sqlite_master WHERE name = ? AND type IN ('table','view')",
		)
		.get(name);
	return Boolean(row);
}

// 空口令判定与 server/posts/service.ts 的 ftsVisible 对齐：只有非空 password 才隐藏正文
const EMPTY_PASSWORD_SQL = "(p.password IS NULL OR p.password = '')";

function collect(db) {
	// FTS 缺行：只算已发布且无口令的（有口令的本来就不该被搜到）
	const missingFts = db
		.prepare(`
      SELECT p.slug FROM posts p
      LEFT JOIN posts_fts f ON f.slug = p.slug
      WHERE p.published = 1 AND ${EMPTY_PASSWORD_SQL} AND f.slug IS NULL
      ORDER BY p.slug
    `)
		.all()
		.map((r) => r.slug);

	// 越权残留：有口令，但 FTS 行里还有正文或摘要
	const leakedBody = db
		.prepare(`
      SELECT p.slug FROM posts p
      JOIN posts_fts f ON f.slug = p.slug
      WHERE NOT ${EMPTY_PASSWORD_SQL}
        AND (COALESCE(f.content, '') <> '' OR COALESCE(f.excerpt, '') <> '')
      ORDER BY p.slug
    `)
		.all()
		.map((r) => r.slug);

	// 幽灵行：posts 里已无此 slug（deletePost 漏删 FTS 的残留），仅报告
	const orphanFts = db
		.prepare(`
      SELECT f.slug FROM posts_fts f
      LEFT JOIN posts p ON p.slug = f.slug
      WHERE p.slug IS NULL
      ORDER BY f.slug
    `)
		.all()
		.map((r) => r.slug);

	return { missingFts, leakedBody, orphanFts };
}

function applyFix(db, slugs) {
	if (!slugs.length) return 0;
	// 单条 prepared statement 包在事务里：避免拼长 IN 列表撞 SQLite 变量上限，也不会半途而废
	const stmt = db.prepare(
		"UPDATE posts_fts SET excerpt = '', content = '' WHERE slug = ?",
	);
	db.exec("BEGIN");
	try {
		for (const slug of slugs) stmt.run(slug);
		db.exec("COMMIT");
	} catch (e) {
		db.exec("ROLLBACK");
		throw e;
	}
	return slugs.length;
}

function printList(title, slugs, emptyText) {
	console.log(`\n${title}（${slugs.length}）`);
	if (!slugs.length) {
		console.log(`  ${emptyText}`);
		return;
	}
	for (const slug of slugs) console.log(`  - ${slug}`);
}

function main() {
	const args = parseArgs(process.argv.slice(2));
	if (args.help) {
		console.log(
			[
				"用法：node scripts/rebuild-fts.mjs [--fix] [--db <local-d1.sqlite>]",
				"",
				"  无参数   只报告差异",
				"  --fix    清空「有口令却仍在 FTS 中留正文/摘要」的行",
				"  --db     指定本地 D1 文件，默认 .wrangler/local-state/local-d1.sqlite（或 $D1_LOCAL_DB）",
			].join("\n"),
		);
		return 0;
	}

	if (!existsSync(args.db)) {
		console.error(`找不到本地 D1 数据库：${args.db}`);
		console.error(
			"先跑一次本地开发（bash scripts/dev.sh）让 cf-dev-shim 建库，或用 --db / D1_LOCAL_DB 指定路径。",
		);
		return 2;
	}

	const db = new DatabaseSync(args.db, { readOnly: !args.fix });
	try {
		if (!tableExists(db, "posts") || !tableExists(db, "posts_fts")) {
			console.error(
				"库里缺少 posts 或 posts_fts 表：确认这是 Firedre 的 D1，且迁移已应用。",
			);
			return 2;
		}

		console.log(
			`[rebuild-fts] db = ${args.db}${args.fix ? "（--fix 写入模式）" : "（只读）"}`,
		);
		const { missingFts, leakedBody, orphanFts } = collect(db);

		printList(
			"已发布、无口令、但 posts_fts 缺行",
			missingFts,
			"无（索引完整）",
		);
		printList(
			"有口令、但 posts_fts 仍留有正文/摘要",
			leakedBody,
			"无（口令文章未进索引）",
		);
		printList("posts_fts 中存在、但 posts 已无对应文章", orphanFts, "无");

		if (missingFts.length) {
			console.log(
				[
					"",
					"第 1 类需要人工补录（脚本无 R2 正文，无法重建）：",
					"  1. 打开后台文章编辑页，载入该文章；",
					"  2. 不做修改直接保存一次 —— upsertPost 会重建 posts 行与 posts_fts 行；",
					"  3. 重新跑本脚本确认为 0。",
				].join("\n"),
			);
		}

		if (args.fix) {
			const fixed = applyFix(db, leakedBody);
			console.log(`\n[rebuild-fts] 已清空 ${fixed} 篇文章的 FTS 正文与摘要。`);
			if (fixed)
				console.log(
					"注意：这些文章重新保存时必须仍有 password，否则正文会重新进索引。",
				);
		} else if (leakedBody.length) {
			console.log("\n用 --fix 清空第 2 类的 FTS 正文/摘要。");
		}

		return missingFts.length || leakedBody.length || orphanFts.length ? 1 : 0;
	} finally {
		db.close();
	}
}

try {
	process.exitCode = main();
} catch (e) {
	console.error("[rebuild-fts] 执行失败：", e instanceof Error ? e.message : e);
	process.exitCode = 2;
}

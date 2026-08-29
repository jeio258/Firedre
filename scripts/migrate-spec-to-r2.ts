#!/usr/bin/env node
/**
 * 将 src/content/spec/*.md 迁移到 R2 spec/{name}.md（friends.mdx 除外，走 links）
 *
 * 用法:
 *   pnpm migrate:spec / pnpm migrate:spec:local
 */

import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { BUCKET_NAME, isLocal, remoteFlag, runWrangler } from "./migrate-utils";

const root = process.cwd();
const specDir = join(root, "src", "content", "spec");
const skip = new Set(["friends.mdx", "friends.md"]);

const files = existsSync(specDir)
	? (await import("node:fs"))
			.readdirSync(specDir)
			.filter((f) => f.endsWith(".md") && !skip.has(f))
	: [];

for (const file of files) {
	const name = basename(file, ".md");
	const tmp = join(root, `.migrate-spec-${name}.tmp.md`);
	writeFileSync(tmp, readFileSync(join(specDir, file), "utf8"), "utf8");
	try {
		runWrangler([
			"r2",
			"object",
			"put",
			`${BUCKET_NAME}/spec/${name}.md`,
			"--file",
			tmp,
			remoteFlag(),
		]);
	} finally {
		if (existsSync(tmp)) unlinkSync(tmp);
	}
	console.log(`已迁移 spec/${name}.md`);
}

console.log(`spec 迁移完成（${files.length} 个文件）`);

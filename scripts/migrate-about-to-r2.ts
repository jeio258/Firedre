#!/usr/bin/env node
/**
 * 将关于页（src/content/spec/about.md）上传到 R2 about/index.md
 *
 * 用法:
 *   pnpm migrate:about / pnpm migrate:about:local
 */

import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { BUCKET_NAME, isLocal, remoteFlag, runWrangler } from "./migrate-utils";

const root = process.cwd();
const aboutPath = join(root, "src", "content", "spec", "about.md");

if (!existsSync(aboutPath)) {
	console.error("未找到 src/content/spec/about.md");
	process.exit(1);
}

const tmpFile = join(root, ".migrate-about-tmp.md");
writeFileSync(tmpFile, readFileSync(aboutPath, "utf8"), "utf8");
try {
	runWrangler([
		"r2",
		"object",
		"put",
		`${BUCKET_NAME}/about/index.md`,
		"--file",
		tmpFile,
		remoteFlag(),
	]);
} finally {
	if (existsSync(tmpFile)) unlinkSync(tmpFile);
}

console.log("已迁移 about/index.md");

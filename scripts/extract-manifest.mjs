#!/usr/bin/env node
/**
 * 从 v14 适配器构建产物中提取完整 Astro manifest，保存为 scripts/firedre-manifest.json。
 * 用法：pnpm build:manifest
 * 前置：package.json 中 @astrojs/cloudflare 为 ^14 且 astro.config.mjs 使用 cloudflare() 适配器。
 */

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { globSync } from "glob";

const root = process.cwd();

// 1. 用 v14 适配器构建（若当前是 v12 则临时切换）
let needRestore = false;
try {
	const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
	if (pkg.devDependencies["@astrojs/cloudflare"]?.startsWith("^12")) {
		needRestore = true;
		execSync('pnpm add -D "@astrojs/cloudflare@^14"', {
			stdio: "inherit",
			cwd: root,
		});
	}
} catch {
	// ignore
}

try {
	try {
		execSync("npx astro build", { stdio: "inherit", cwd: root });
	} catch {
		/* v14 构建末尾 preview 配置解析可能报错，dist/server 已生成，忽略 */
	}

	// 2. 在 dist/server/chunks 中定位注入的 manifest
	const candidates = globSync("dist/server/chunks/*.mjs", { cwd: root });
	let found = false;
	for (const rel of candidates) {
		const file = join(root, rel);
		const code = readFileSync(file, "utf8");
		const marker = "var _manifest = deserializeManifest(";
		const idx = code.indexOf(marker);
		if (idx === -1) continue;
		const start = code.indexOf("{", idx);
		let depth = 0;
		for (let j = start; j < code.length; j++) {
			const ch = code[j];
			if (ch === "{") depth++;
			else if (ch === "}") {
				depth--;
				if (depth === 0) {
					const json = code.slice(start, j + 1);
					JSON.parse(json); // 校验
					writeFileSync(
						join(root, "scripts", "firedre-manifest.json"),
						json,
						"utf8",
					);
					console.log(
						`[extract-manifest] saved ${json.length} chars from ${rel}`,
					);
					found = true;
					break;
				}
			}
		}
		if (found) break;
	}
	if (!found) {
		console.error("[extract-manifest] 未找到注入的 manifest，请检查构建产物");
		process.exit(1);
	}
} finally {
	if (needRestore) {
		try {
			execSync('pnpm add -D "@astrojs/cloudflare@^12"', {
				stdio: "inherit",
				cwd: root,
			});
		} catch (e) {
			console.error(
				"[extract-manifest] 恢复 v12 适配器失败，请手动执行 pnpm add -D @astrojs/cloudflare@^12",
			);
			process.exit(1);
		}
	}
}

#!/usr/bin/env node

/**
 * 密码哈希迁移工具
 *
 * 将明文密码转换为 bcrypt 哈希存储
 * 用法: node scripts/migrate-password-hash.js [新密码]
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import bcrypt from "bcryptjs";

const ARGS = process.argv.slice(2);
const NEW_PASSWORD = ARGS[0];

if (!NEW_PASSWORD) {
	console.error("用法: node scripts/migrate-password-hash.js <新密码>");
	console.error("");
	console.error("示例:");
	console.error('  node scripts/migrate-password-hash.js "my-secure-password"');
	console.error("  node scripts/migrate-password-hash.js");
	process.exit(1);
}

async function migratePassword() {
	console.log("正在生成 bcrypt 哈希...");

	// 生成哈希
	const hash = await bcrypt.hash(NEW_PASSWORD, 10);

	console.log("\n生成的哈希:");
	console.log(`ADMIN_PASSWORD=${hash}`);

	console.log("\n请将以下行添加到 .dev.vars 文件:");
	console.log(`ADMIN_PASSWORD=${hash}`);

	// 验证哈希
	console.log("\n验证哈希...");
	const isValid = await bcrypt.compare(NEW_PASSWORD, hash);
	console.log(`密码验证: ${isValid ? "✓ 成功" : "✗ 失败"}`);

	// 询问是否更新 .dev.vars
	if (process.stdout.isTTY) {
		const readline = await import("node:readline").then((m) =>
			m.createInterface({ input: process.stdin, output: process.stdout }),
		);
		const answer = await new Promise((resolve) => {
			readline.question("\n是否更新 .dev.vars 文件? (y/N): ", resolve);
		});

		if (answer.toLowerCase() === "y") {
			const devVarsPath = resolve(process.cwd(), ".dev.vars");
			let content = "";

			try {
				content = readFileSync(devVarsPath, "utf8");
			} catch {
				// 文件不存在，创建新文件
			}

			// 更新或添加 ADMIN_PASSWORD
			const lines = content.split("\n");
			const passwordLineIndex = lines.findIndex((line) =>
				line.startsWith("ADMIN_PASSWORD"),
			);

			if (passwordLineIndex >= 0) {
				lines[passwordLineIndex] = `ADMIN_PASSWORD=${hash}`;
			} else {
				lines.push(`ADMIN_PASSWORD=${hash}`);
			}

			writeFileSync(devVarsPath, lines.join("\n"));
			console.log(`\n✓ 已更新 ${devVarsPath}`);
		}

		readline.close();
	}

	console.log("\n完成!");
}

migratePassword().catch((err) => {
	console.error("错误:", err.message);
	process.exit(1);
});

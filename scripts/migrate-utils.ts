/**
 * 迁移脚本公共工具：wrangler CLI 封装（R2 上传 / D1 执行）
 */

import { spawnSync } from "node:child_process";
import { existsSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const DB_NAME = "firedre-blog";
export const BUCKET_NAME = "firedre-blog";

export function isLocal(): boolean {
	return process.argv.includes("--local");
}

export function remoteFlag(): string {
	return isLocal() ? "--local" : "--remote";
}

export function runWrangler(args: string[]) {
	const result = spawnSync("npx", ["wrangler", ...args], {
		cwd: process.cwd(),
		stdio: "inherit",
		shell: false,
	});
	if (result.status !== 0) process.exit(result.status || 1);
}

export function runWranglerSql(sql: string) {
	const file = join(process.cwd(), ".migrate-tmp.sql");
	writeFileSync(file, sql, "utf8");
	try {
		runWrangler(["d1", "execute", DB_NAME, remoteFlag(), "--file", file]);
	} finally {
		if (existsSync(file)) unlinkSync(file);
	}
}

export function sqlValue(value: unknown): string {
	if (value === null || value === undefined) return "NULL";
	return `'${String(value).replace(/'/g, "''")}'`;
}

export function sqlInt(value: unknown): string {
	const n = Number(value);
	return Number.isFinite(n) ? String(Math.trunc(n)) : "0";
}

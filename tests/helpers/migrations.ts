import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";

export function migrationsDir(): string {
	return join(process.cwd(), "migrations");
}

export function migrationFiles(files?: string[]): string[] {
	if (files) return files;
	return readdirSync(migrationsDir())
		.filter((f) => f.endsWith(".sql"))
		.sort();
}

/** 按序对内存库执行迁移；不传 files 时按文件名排序全部应用 */
export function applyMigrations(db: DatabaseSync, files?: string[]): void {
	const dir = migrationsDir();
	for (const file of migrationFiles(files)) {
		db.exec(readFileSync(join(dir, file), "utf8"));
	}
}

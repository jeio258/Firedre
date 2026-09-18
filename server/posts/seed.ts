// 幂等基线迁移（IF NOT EXISTS）：空库首次访问时自动建表，见 ensureSchema
import initSql from "../../migrations/0001_init.sql?raw";
// 构建时内联默认文章源文（Workers 运行时无文件系统）
import firedreSource from "../../posts/firedre.md?raw";
import type { CloudflareEnv } from "../../types/env";
import { upsertPost } from "./service";

let schemaReady = false;

// 引号感知的 SQL 语句拆分：D1.exec 按换行截断多行语句，无法执行本迁移文件；
// 分号仅在字符串字面量之外才视为语句结束（SQL 字符串用 '' 转义，成对翻转恰好正确）
function splitSqlStatements(sql: string): string[] {
	const statements: string[] = [];
	let current = "";
	let inString = false;
	for (const line of sql.split("\n")) {
		const trimmed = line.trimStart();
		if (!inString && (trimmed === "" || trimmed.startsWith("--"))) continue;
		for (const ch of line) {
			if (ch === "'") inString = !inString;
			else if (ch === ";" && !inString) {
				statements.push(current);
				current = "";
				continue;
			}
			current += ch;
		}
		current += "\n";
	}
	if (current.trim()) statements.push(current);
	return statements.map((s) => s.trim()).filter((s) => s.length > 0);
}

// 数据库 schema 引导：缺表（全新库未跑迁移）时执行幂等基线迁移，避免渲染层查询 500
export async function ensureSchema(env: CloudflareEnv): Promise<void> {
	if (schemaReady) return;
	try {
		await env.DB.prepare("SELECT 1 FROM site_settings LIMIT 1").run();
		schemaReady = true;
		return;
	} catch {
		// 表缺失 → 引导建表
	}
	try {
		const statements = splitSqlStatements(initSql).map((sql) =>
			env.DB.prepare(sql),
		);
		await env.DB.batch(statements);
		schemaReady = true;
		console.log(
			`[bootstrap] 空库已自动应用基线迁移（${statements.length} 条语句）`,
		);
	} catch (e) {
		console.warn("[bootstrap] 数据库初始化失败，页面将以空数据渲染", e);
	}
}

export async function ensureDefaultPosts(env: CloudflareEnv): Promise<void> {
	await ensureSchema(env);
	try {
		const row = await env.DB.prepare("SELECT COUNT(*) AS c FROM posts").first<{
			c: number;
		}>();
		if (row && Number(row.c) > 0) return;
		await upsertPost(env, "firedre", firedreSource);
	} catch {}
}

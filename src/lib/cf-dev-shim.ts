/**
 * 本地开发（纯 astro dev，非 workerd）的 Cloudflare 绑定模拟垫片。
 * 使本地 `pnpm dev` 能实时读取/写入 D1（站点设置等）、R2（文章/相册等）、后台登录。
 *
 * - D1：.wrangler/local-state/local-d1.sqlite（自动从 migrations/*.sql 建表，无需手动迁移）
 * - R2：.wrangler/local-state/local-r2/ 文件系统
 * - 会话：HMAC + Cookie（无需 KV）
 * - .dev.vars：缺失时自动生成默认值（与生产 secrets 一致）
 */

import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";

const root = process.cwd();
const stateDir = join(root, ".wrangler", "local-state");

// ── 自动生成 .dev.vars（后台登录凭据等）──
try {
	const devVarsPath = join(root, ".dev.vars");
	if (!existsSync(devVarsPath)) {
		const defaults = [
			"ADMIN_USERNAME=admin",
			// 本地开发默认密码（明文，仅本地）；生产部署请用 pnpm migrate-password 生成 bcrypt 哈希
			"ADMIN_PASSWORD=firedre-admin-8888",
			"ADMIN_API_TOKEN=dev-token-firedre-abc123xyz",
			// 会话签名密钥（必须 >= 32 字符，否则本地登录会失败）
			"SESSION_SECRET=dev-session-secret-firedre-local-00000000",
			"SITE_URL=http://localhost:4321",
			"",
		].join("\n");
		writeFileSync(devVarsPath, defaults);
		console.log("[cf-dev-shim] 已生成 .dev.vars（本地后台凭据默认与生产一致）");
	}
} catch {
	// 生成失败不阻塞
}

// ── D1：本地 SQLite + 自动迁移 ──
let db: DatabaseSync | null = null;
try {
	mkdirSync(stateDir, { recursive: true });
	db = new DatabaseSync(join(stateDir, "local-d1.sqlite"));
	db.exec("PRAGMA journal_mode = WAL");

	// 幂等建迁移记录表
	db.exec(
		"CREATE TABLE IF NOT EXISTS __firedre_migrations (name TEXT PRIMARY KEY)",
	);
	const applied = new Set<string>();
	for (const row of db
		.prepare("SELECT name FROM __firedre_migrations")
		.all() as Array<{ name: string }>) {
		applied.add(row.name);
	}

	// 按序执行未应用的 migrations/*.sql
	const migDir = join(root, "migrations");
	if (existsSync(migDir)) {
		const files = readdirSync(migDir)
			.filter((f) => f.endsWith(".sql"))
			.sort();
		for (const file of files) {
			if (applied.has(file)) continue;
			const sql = readFileSync(join(migDir, file), "utf8");
			db.exec(sql);
			db.prepare("INSERT INTO __firedre_migrations (name) VALUES (?)").run(
				file,
			);
			console.log(`[cf-dev-shim] 已应用迁移 ${file}`);
		}
	}
} catch (e) {
	console.error("[cf-dev-shim] D1 初始化失败:", (e as Error).message);
	db = null;
}

class D1Stmt {
	private args: unknown[] = [];
	constructor(
		private d: DatabaseSync,
		private sql: string,
	) {}
	bind(...args: unknown[]) {
		this.args = args;
		return this;
	}
	first<T = Record<string, unknown>>(): T | null {
		try {
			const row = this.d.prepare(this.sql).get(...(this.args as string[])) as
				| T
				| undefined;
			return row ?? null;
		} catch {
			return null;
		}
	}
	all<T = Record<string, unknown>>(): { results: T[] } {
		try {
			return {
				results: this.d
					.prepare(this.sql)
					.all(...(this.args as string[])) as T[],
			};
		} catch {
			return { results: [] };
		}
	}
	run() {
		try {
			const info = this.d.prepare(this.sql).run(...(this.args as string[])) as {
				changes?: number | bigint;
				lastInsertRowid?: number | bigint;
			};
			return {
				success: true,
				meta: {
					changes: Number(info.changes ?? 0),
					lastRowId: Number(info.lastInsertRowid ?? 0),
				},
			};
		} catch {
			return { success: false, meta: { changes: 0, lastRowId: 0 } };
		}
	}
}

const DB = db
	? { prepare: (sql: string) => new D1Stmt(db as DatabaseSync, sql) }
	: undefined;

// ── R2：本地文件系统 ──
const r2Dir = join(stateDir, "local-r2");
const r2Path = (key: string) => {
	const safe = key
		.split("/")
		.map((seg) => seg.replace(/[^a-zA-Z0-9._-]/g, "_"))
		.join("/");
	return join(r2Dir, safe);
};

const BUCKET = {
	async get(key: string) {
		const p = r2Path(key);
		if (!existsSync(p)) return null;
		const content = readFileSync(p, "utf8");
		return {
			key,
			size: content.length,
			text: async () => content,
			body: new Response(content).body,
		};
	},
	async put(key: string, value: string | ArrayBuffer | Uint8Array) {
		const p = r2Path(key);
		mkdirSync(dirname(p), { recursive: true });
		const buf =
			typeof value === "string"
				? value
				: Buffer.from(value as ArrayBuffer).toString("utf8");
		writeFileSync(p, buf);
		return { key };
	},
	async delete(key: string) {
		const p = r2Path(key);
		if (existsSync(p)) rmSync(p);
		return { key };
	},
};

export const env = {
	DB,
	BUCKET,
	SESSION: new Map(),
	SITE_URL: "http://localhost:4321",
};
export const context = undefined;
export const caches = undefined;

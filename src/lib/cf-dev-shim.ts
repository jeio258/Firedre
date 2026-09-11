

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

let devSessionSecret: string | undefined;
try {
	const devVarsPath = join(root, ".dev.vars");
	if (!existsSync(devVarsPath)) {
		const defaults = [
			// 会话签名密钥（必须配置，否则后台无法登录）
			"SESSION_SECRET=dev-session-secret-firedre-local-00000000",
			"",
		].join("\n");
		writeFileSync(devVarsPath, defaults);
		console.log("[cf-dev-shim] 已生成 .dev.vars（会话签名密钥）");
	}
	// 与生产一致：secrets 通过 env 注入（loadAdminEnv 之外的模块也能取到）
	for (const line of readFileSync(devVarsPath, "utf8").split("\n")) {
		const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
		if (m && !m[1].startsWith("COMMENT")) process.env[m[1]] ??= m[2];
	}
	devSessionSecret = process.env.SESSION_SECRET;
} catch {
	// 生成/读取失败不阻塞
}

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

	// 清理统一 schema 前的废弃旧表
	for (const t of [
		"post_categories",
		"post_tags",
		"api_rate_limits",
		"admin_login_attempts",
	]) {
		db.exec(`DROP TABLE IF EXISTS ${t}`);
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
		const buf = readFileSync(p);
		return {
			key,
			size: buf.length,
			arrayBuffer: async () =>
				buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
			text: async () => buf.toString("utf8"),
			json: async () => JSON.parse(buf.toString("utf8")),
			body: new Response(buf).body,
		};
	},
	async put(key: string, value: string | ArrayBuffer | ArrayBufferView | Buffer) {
		const p = r2Path(key);
		mkdirSync(dirname(p), { recursive: true });
		const buf = Buffer.isBuffer(value)
			? value
			: typeof value === "string"
				? Buffer.from(value, "utf8")
				: Buffer.from(value as ArrayBufferLike);
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
	SESSION_SECRET: devSessionSecret,
};
export const context = undefined;

// dev 内存版 CacheStorage：让 HTML 缓存中间件在本地与线上语义一致（可被命中/失效）。
// 用 globalThis 承载存储：Astro dev 会按请求重新求值 SSR 模块，模块级变量无法跨请求存活。
const __globalCache = globalThis as unknown as { __firedreHtmlCache?: Map<string, Response> };
const __htmlCache = __globalCache.__firedreHtmlCache ?? (__globalCache.__firedreHtmlCache = new Map<string, Response>());
const __cacheKeyOf = (input: string | Request): string =>
  typeof input === "string" ? input : input.url;
const __devCache = {
  async match(key: string | Request): Promise<Response | undefined> {
    const hit = __htmlCache.get(__cacheKeyOf(key));
    return hit ? hit.clone() : undefined;
  },
  async put(key: string | Request, response: Response): Promise<void> {
    __htmlCache.set(__cacheKeyOf(key), response.clone());
  },
  async delete(key: string | Request): Promise<boolean> {
    return __htmlCache.delete(__cacheKeyOf(key));
  },
} as const;
export const caches = { default: __devCache } as const;

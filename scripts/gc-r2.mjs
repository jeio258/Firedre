// R2 历史版本对象 GC 对账（E-01 待办落地）：
// 扫描本地 R2（.wrangler/local-state/local-r2）中 posts/ 前缀对象，
// 与 D1 posts 表当前 r2_key 指针比对，列出/删除无指针引用的孤儿对象（旧版本正文）。
// 默认 dry-run 只列不删；--delete 执行删除。生产 R2 对账见 Firedre.log 待办。
import { readdirSync, rmSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { DatabaseSync } from "node:sqlite";

const ROOT = process.cwd();
const STATE_DIR = join(ROOT, ".wrangler", "local-state");
const R2_DIR = join(STATE_DIR, "local-r2");
const D1_PATH = join(STATE_DIR, "local-d1.sqlite");
const POSTS_PREFIX = "posts";

/** 与 cf-dev-shim r2Path 一致：key 每段替换非安全字符后落盘 */
export function localPathFromKey(key, r2Dir = R2_DIR) {
	const safe = key
		.split("/")
		.map((seg) => seg.replace(/[^a-zA-Z0-9._-]/g, "_"))
		.join("/");
	return join(r2Dir, safe);
}

/** 差集：allObjectKeys 中未被 activeKeys 引用的孤儿 key（key 级纯函数） */
export function computeOrphans(activeKeys, allObjectKeys) {
	const active = new Set(activeKeys);
	return allObjectKeys.filter((k) => !active.has(k));
}

function walkDir(dir) {
	const out = [];
	for (const name of readdirSync(dir)) {
		const p = join(dir, name);
		if (statSync(p).isDirectory()) out.push(...walkDir(p));
		else out.push(p);
	}
	return out;
}

function readActiveR2Keys() {
	if (!existsSync(D1_PATH)) {
		throw new Error(`本地 D1 不存在：${D1_PATH}（请先运行 pnpm dev 初始化）`);
	}
	const db = new DatabaseSync(D1_PATH, { readOnly: true });
	try {
		const rows = db
			.prepare(`SELECT r2_key FROM posts WHERE r2_key IS NOT NULL`)
			.all();
		return rows.map((r) => String(r.r2_key));
	} finally {
		db.close();
	}
}

export function main() {
	const r2Root = join(R2_DIR, POSTS_PREFIX);
	if (!existsSync(r2Root)) {
		console.log(`[gc-r2] 本地 R2 无 ${POSTS_PREFIX}/ 前缀对象，无需对账`);
		return { orphans: [], deleted: [] };
	}

	const activeKeys = readActiveR2Keys();
	// 本地对象按文件相对路径比对（r2Path 清洗后路径，与 D1 key 映射一致）
	const activePaths = new Set(activeKeys.map((k) => localPathFromKey(k)));
	const allObjectPaths = walkDir(r2Root);
	const orphanPaths = computeOrphans([...activePaths], allObjectPaths);

	const dryRun = !process.argv.includes("--delete");
	console.log(
		`[gc-r2] 活跃指针 ${activePaths.size} / 本地对象 ${allObjectPaths.length} / 孤儿 ${orphanPaths.length}（${dryRun ? "dry-run" : "删除"}）`,
	);
	for (const p of orphanPaths) console.log(`  ${dryRun ? "[待删]" : "[删除]"} ${p}`);

	const deleted = [];
	if (!dryRun) {
		for (const p of orphanPaths) {
			rmSync(p);
			deleted.push(p);
		}
	}
	return { orphans: orphanPaths, deleted };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
	main();
}

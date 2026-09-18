#!/usr/bin/env node
// 防恶化门禁：@ts-nocheck 文件数与 as any 出现次数只允许减少不允许新增。
// 存量清单化（允许列表）：新增文件/新增出现即失败，存量修复后可同步缩减基线。
import { execSync } from "node:child_process";

const ROOT = new URL("../..", import.meta.url).pathname;

// 基线：首次运行时按当前存量固化（改动后请同步下调，禁止上调）
const BASELINE = {
	tsNocheckFiles: 4,
	asAnyCount: 238,
};

function sh(cmd) {
	return execSync(cmd, { cwd: ROOT, encoding: "utf8" }).trim();
}

const tsNocheckFiles = sh(
	`grep -rl "@ts-nocheck" src --include="*.astro" --include="*.ts" --include="*.svelte" | wc -l`,
);
const asAnyCount = sh(
	`grep -ro "as any" src --include="*.astro" --include="*.ts" --include="*.svelte" | wc -l`,
);

const failures = [];
if (Number(tsNocheckFiles) > BASELINE.tsNocheckFiles) {
	failures.push(
		`@ts-nocheck 文件数 ${tsNocheckFiles} > 基线 ${BASELINE.tsNocheckFiles}（禁止新增）`,
	);
}
if (Number(asAnyCount) > BASELINE.asAnyCount) {
	failures.push(
		`as any 出现 ${asAnyCount} 次 > 基线 ${BASELINE.asAnyCount}（禁止新增）`,
	);
}

console.log(
	`[baseline] @ts-nocheck 文件: ${tsNocheckFiles}/${BASELINE.tsNocheckFiles}`,
);
console.log(`[baseline] as any 次数: ${asAnyCount}/${BASELINE.asAnyCount}`);

if (failures.length > 0) {
	console.error("[baseline] 超出基线：");
	for (const f of failures) console.error(`  - ${f}`);
	process.exit(1);
}
console.log("[baseline] 通过");

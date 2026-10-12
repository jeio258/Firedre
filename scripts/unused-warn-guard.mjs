#!/usr/bin/env node
// 护栏：把 astro check 的「未使用变量」告警（ts6133）纳入门禁——新增即失败。
//
// 防错：astro check 对未使用变量只报 warning(ts6133)，而 check 只把 error 当失败 →
// 曾因此漏掉「配置取到却未使用 → 静默失效」的真 bug。故将该类告警与基线比对：
// 新增即失败，原有入基线。
//
// 用法：node scripts/unused-warn-guard.mjs [--update]
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url)).replace(/\/+$/, "");
const BASELINE = `${ROOT}/scripts/unused-warn-baseline.txt`;
const UPDATE = process.argv.includes("--update");

const r = spawnSync("npx", ["astro", "check"], {
	encoding: "utf8",
	maxBuffer: 64 * 1024 * 1024,
});
const raw = `${r.stdout ?? ""}\n${r.stderr ?? ""}`;
const clean = raw.replace(/\u001b\[[0-9;]*m/g, "");

// 有 error 时按原语义直接失败（保持 astro check 的既有行为）
if ((r.status ?? 0) !== 0) {
	process.stdout.write(clean);
	console.error("\n[unused-warn-guard] astro check 存在 error，已失败。");
	process.exit(r.status ?? 1);
}

// 解析未使用变量告警：`<file>:<line>:<col> - warning ts(6133): '<name>' is declared but its value is never read`
const hits = new Set();
const re =
	/^(.+?):(\d+):(\d+) - warning ts\(6133\): '([^']+)' is declared but its? value is never read/m;
for (const m of clean.matchAll(new RegExp(re.source, "gm"))) {
	// 键用「文件 + 变量名」，不含行号 → 编辑不漂移
	hits.add(`${m[1].replace(`${ROOT}/`, "")}  ${m[4]}`);
}
const now = [...hits].sort();

if (UPDATE || !existsSync(BASELINE)) {
	writeFileSync(BASELINE, `${now.join("\n")}${now.length ? "\n" : ""}`);
	console.log(
		`[unused-warn-guard] 已写入基线（${now.length} 条）：scripts/unused-warn-baseline.txt`,
	);
	process.exit(0);
}

const base = new Set(
	readFileSync(BASELINE, "utf8")
		.split("\n")
		.map((l) => l.trim())
		.filter(Boolean),
);
const added = now.filter((h) => !base.has(h));
const removed = [...base].filter((h) => !now.includes(h));

if (added.length) {
	console.error(
		"[unused-warn-guard] ✗ 新增「未使用变量」（多为配置取值后未接线的真 bug 信号）：",
	);
	for (const a of added) console.error(`      ${a}`);
	if (removed.length) {
		console.error("      另：以下基线项已消失，可 --update 精简基线：");
		for (const x of removed) console.error(`        ${x}`);
	}
	process.exit(1);
}
console.log(
	`[unused-warn-guard] ✓ 无新增未使用变量告警（基线 ${base.size} 条 / 当前 ${now.length} 条）`,
);

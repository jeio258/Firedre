// biome 基线冻结：存量违规不拦截，新增违规视为失败（退出码 1）。
// 用法：
//   node scripts/qa/biome-baseline.mjs            对比基线（CI / 本地门禁）
//   node scripts/qa/biome-baseline.mjs --update   重新生成基线（确认存量变化后使用）
// 基线粒度：文件 + 规则 的出现次数（行号变化不误报，同文件同规则新增会被拦截）。
import { writeFileSync, existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const BASELINE = "scripts/qa/biome-baseline.txt";
// 与 package.json 的 lint 脚本范围保持一致
const BIOME_ARGS = [
	"biome",
	"check",
	"./src",
	"./server",
	"./shared",
	"./types",
	"--no-errors-on-unmatched",
	"--max-diagnostics=none",
];

let raw;
try {
	raw = execFileSync("npx", BIOME_ARGS, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
} catch (e) {
	raw = String(e.stdout || "") + String(e.stderr || "");
}

// 诊断行形如：path:line:col lint/rule/name  [FIXABLE]  ━━━
const counts = new Map();
for (const m of raw.matchAll(/^([^\s:]+\.[a-z]+):\d+:\d+ (lint\/[\w/]+)/gm)) {
	const key = `${m[1]} ${m[2]}`;
	counts.set(key, (counts.get(key) || 0) + 1);
}

if (process.argv.includes("--update")) {
	const lines = [...counts.entries()]
		.sort(([a], [b]) => (a < b ? -1 : 1))
		.map(([k, n]) => `${k} ${n}`);
	writeFileSync(BASELINE, lines.join("\n") + "\n");
	console.log(`基线已更新：${counts.size} 个文件/规则组合，共 ${[...counts.values()].reduce((a, b) => a + b, 0)} 条诊断`);
	process.exit(0);
}

if (!existsSync(BASELINE)) {
	console.error(`未找到基线文件 ${BASELINE}，请先运行：node scripts/qa/biome-baseline.mjs --update`);
	process.exit(1);
}

const base = new Map();
for (const line of readFileSync(BASELINE, "utf8").split("\n").filter(Boolean)) {
	const idx = line.lastIndexOf(" ");
	base.set(line.slice(0, idx), Number(line.slice(idx + 1)));
}

const added = [];
for (const [k, n] of counts) {
	const b = base.get(k) || 0;
	if (n > b) added.push(`${k}: ${b} -> ${n}`);
}
if (added.length) {
	console.error("发现新增 biome 违规（基线冻结拦截）：");
	for (const a of added) console.error("  " + a);
	console.error(`如属存量清理确认后的变化，请运行：node scripts/qa/biome-baseline.mjs --update`);
	process.exit(1);
}
console.log(`biome 基线对比通过（当前 ${counts.size} 组合，无新增违规）`);

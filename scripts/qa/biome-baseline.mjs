// biome 基线冻结（JSON reporter 版）：存量诊断不拦截，新增诊断为失败（退出码 1）。
// 用法：
//   node scripts/qa/biome-baseline.mjs            对比基线（CI / 本地门禁）
//   node scripts/qa/biome-baseline.mjs --update   重新生成基线（确认存量变化后使用）
// 基线粒度：文件 + 诊断类别 的出现次数（行号变化不误报；同文件同类别新增会被拦截）。
// 语法错误（parse/*）不进基线：出现即失败。
import { writeFileSync, existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const BASELINE = "scripts/qa/biome-baseline.txt";
// 与 package.json 的 lint 脚本范围保持一致；上限取消防截断；JSON 输出全类别可靠解析
const BIOME_ARGS = [
	"biome",
	"check",
	"./src",
	"./server",
	"./shared",
	"./types",
	"--max-diagnostics=none",
	"--reporter=json",
	"--no-errors-on-unmatched",
];

function runBiome() {
	try {
		const out = execFileSync("npx", BIOME_ARGS, {
			encoding: "utf8",
			stdio: ["ignore", "pipe", "pipe"],
			maxBuffer: 64 * 1024 * 1024,
		});
		return JSON.parse(out);
	} catch (e) {
		// biome 发现诊断时退出码非 0，JSON 在 stdout
		try {
			return JSON.parse(String(e.stdout || ""));
		} catch {
			console.error("biome 输出无法解析为 JSON，无法判定：");
			console.error(String(e.stderr || e.message || "").slice(0, 800));
			process.exit(1);
		}
	}
}

function countOf(json) {
	const counts = new Map();
	for (const d of json.diagnostics || []) {
		if (d.category.startsWith("parse/")) {
			console.error(`发现语法错误（不在基线范围，必须修复）：${d.location?.path} ${d.message}`);
			process.exit(1);
		}
		const key = `${d.location?.path} ${d.category}`;
		counts.set(key, (counts.get(key) || 0) + 1);
	}
	const sum = [...counts.values()].reduce((a, b) => a + b, 0);
	const total =
		(json.summary?.errors || 0) + (json.summary?.warnings || 0) + (json.summary?.infos || 0);
	if (total !== sum || (json.summary?.diagnosticsNotPrinted || 0) > 0) {
		console.error(`诊断完整性校验失败：summary 总数 ${total}，解析 ${sum} 条（diagnosticsNotPrinted=${json.summary?.diagnosticsNotPrinted}）`);
		process.exit(1);
	}
	return { counts, total };
}

const json = runBiome();
const { counts, total } = countOf(json);

if (process.argv.includes("--update")) {
	const lines = [...counts.entries()]
		.sort(([a], [b]) => (a < b ? -1 : 1))
		.map(([k, n]) => `${k} ${n}`);
	writeFileSync(BASELINE, lines.join("\n") + "\n");
	console.log(`基线已更新：${counts.size} 个文件/类别组合，共 ${total} 条诊断`);
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
	console.error("如属存量清理确认后的变化，请运行：node scripts/qa/biome-baseline.mjs --update");
	process.exit(1);
}
console.log(`biome 基线对比通过（当前 ${counts.size} 组合 / ${total} 条诊断，无新增违规）`);

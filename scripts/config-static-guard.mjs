#!/usr/bin/env node
// B21 护栏：运行期代码不得从静态 @/config 快照读取「后台可编辑字段」。
// 背景：R1–R4 修复的就是「后台改了设置、前台仍用静态 defaults」这类真 bug。
// 判据：src/** 中 `import { X } from "@/config"`（或相对 ../config）得到的静态 config 对象，
//       其对 adminSettingsSchema 可编辑字段的一级成员访问 → 视为可疑，须走运行时 getter。
// 说明：字段名按全 schema 取并集，跨组同名（title/enable/mode/type/favicon…）可能有误报；
//       基线即"已人工确认可接受"的白名单，新增命中须先确认（确为真 bug 则修复，否则 --update）。
// 用法：node scripts/config-static-guard.mjs [--update]
import {
	existsSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildSync } from "esbuild";

const ROOT = fileURLToPath(new URL("..", import.meta.url)).replace(/\/+$/, "");
const SRC = join(ROOT, "src");
const BASELINE = join(ROOT, "scripts", "config-static-baseline.txt");
const UPDATE = process.argv.includes("--update");

const ENTRY = `
import { GROUPS } from "@components/admin/adminSettingsSchema";
module.exports = {
  editable: [...new Set(GROUPS.flatMap((g) => g.fields.map((f) => f.name)))].sort(),
};
`;

const dir = mkdtempSync(join(tmpdir(), "firedre-guard-"));
let editableList = [];
try {
	const entryPath = join(dir, "entry.ts");
	const outPath = join(dir, "out.cjs");
	writeFileSync(entryPath, ENTRY);
	buildSync({
		entryPoints: [entryPath],
		outfile: outPath,
		bundle: true,
		platform: "node",
		format: "cjs",
		alias: {
			"@shared": join(ROOT, "shared"),
			"@components": join(ROOT, "src/components"),
			"@server": join(ROOT, "server"),
		},
		logLevel: "silent",
	});
	const mod = (await import(pathToFileURL(outPath).href)).default;
	editableList = mod.editable;
} finally {
	rmSync(dir, { recursive: true, force: true });
}
const editable = new Set(editableList);

function walk(d, re, acc = []) {
	for (const e of readdirSync(d)) {
		const p = join(d, e);
		if (statSync(p).isDirectory()) {
			if (e === "node_modules") continue;
			walk(p, re, acc);
		} else if (re.test(e)) acc.push(p);
	}
	return acc;
}

function staticIdents(text) {
	const s = new Set();
	const re =
		/import\s*\{([^}]*)\}\s*from\s*["'](?:@\/config|(?:\.\.\/)+config)["']/g;
	for (const m of text.matchAll(re)) {
		for (const raw of m[1].split(",")) {
			const x = raw
				.trim()
				.split(/\s+as\s+/)
				.pop()
				.trim();
			if (x) s.add(x);
		}
	}
	return s;
}

// 命中键：仓库相对路径 + "ident.field"（不含行号，避免编辑漂移）
const hits = new Set();
for (const abs of walk(SRC, /\.(ts|astro|svelte)$/)) {
	const rel = abs.slice(ROOT.length + 1);
	const text = readFileSync(abs, "utf8");
	for (const ident of staticIdents(text)) {
		const re = new RegExp(`\\b${ident}\\.([A-Za-z_$][\\w$]*)`, "g");
		for (const m of text.matchAll(re)) {
			if (editable.has(m[1])) hits.add(`${rel}  ${ident}.${m[1]}`);
		}
	}
}
const now = [...hits].sort();

if (UPDATE || !existsSync(BASELINE)) {
	writeFileSync(BASELINE, `${now.join("\n")}${now.length ? "\n" : ""}`);
	console.log(
		`[config-static-guard] 已写入基线（${now.length} 条）：scripts/config-static-baseline.txt`,
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
	console.log(
		"FAIL  新增「静态 config 读取后台可编辑字段」（改用 getXxxConfig(Astro.locals) / …FromWindow）：",
	);
	for (const a of added) console.log(`      ${a}`);
	if (removed.length) {
		console.log("      另：以下基线项已消失，可 --update 精简基线：");
		for (const r of removed) console.log(`        ${r}`);
	}
	process.exit(1);
}
console.log(
	`PASS  无新增静态读取可编辑字段（基线 ${base.size} 条 / 当前 ${now.length} 条）`,
);

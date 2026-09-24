// F1/F3 字体分片生成：从全量 woff2 切分为「频率种子 + 码位块」多个 woff2，并输出 unicode-range 元数据
// 用法: node scripts/fonts/shard-cjk.mjs
// 产物: src/assets/fonts/shards/shard-N.woff2 + shards/manifest.json
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const wawoff2 = require("wawoff2");
const subsetFont = require("subset-font");

const SRC = "src/assets/fonts/FangzhengZhuZiA-YuanB.woff2";
const OUT_DIR = "assets/fonts/shards";   // 非 public：未接线时不进入部署产物
const CSS_OUT = "src/styles/font-shards.css";
const SEED_CHARS = 300;      // 种子分片包含的高频汉字数
const BLOCK = 1000;          // 其余 CJK 每块码位数

// ---------- 1) 从项目自身语料统计字频（首屏文案/UI 用字的主要来源）----------
function walk(dir, exts, acc = []) {
	for (const name of readdirSync(dir)) {
		const p = join(dir, name);
		const st = statSync(p);
		if (st.isDirectory()) walk(p, exts, acc);
		else if (exts.some((e) => name.endsWith(e))) acc.push(p);
	}
	return acc;
}
const files = [...walk("src", [".astro", ".svelte", ".ts"]), ...walk("shared", [".ts"])];
const freq = new Map();
for (const f of files) {
	const txt = readFileSync(f, "utf8");
	for (const ch of txt) {
		const cp = ch.codePointAt(0);
		if (cp >= 0x3400 && cp <= 0x9fff) freq.set(ch, (freq.get(ch) || 0) + 1);   // CJK 统一表意文字
	}
}
const ranked = [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);

// ---------- 2) 构造分片字符集 ----------
const PUNCT = " !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~，。！？、；：（）《》“”‘’—…·「」『』【】〔〕％＋－×÷＝";
const seedCjk = ranked.slice(0, SEED_CHARS);
const rest = new Set(ranked.slice(SEED_CHARS));
// 源字体覆盖的其余 CJK（GB2312 常用区），按码位补齐到块中
for (let cp = 0x4e00; cp <= 0x9fff; cp++) rest.add(String.fromCodePoint(cp));
for (const c of seedCjk) rest.delete(c);

const ordered = [...rest].sort((a, b) => a.codePointAt(0) - b.codePointAt(0));
const shards = [{ name: "shard-0-seed", chars: new Set([...(PUNCT), ...seedCjk]) }];
for (let i = 0; i < ordered.length; i += BLOCK) {
	shards.push({ name: `shard-${shards.length}`, chars: new Set(ordered.slice(i, i + BLOCK)) });
}

// ---------- 3) 子集化并输出 ----------
const src = readFileSync(SRC);
const ttf = Buffer.from(await wawoff2.decompress(src));
rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

const manifest = [];
let total = 0;
for (const s of shards) {
	const text = [...s.chars].join("");
	const out = Buffer.from(await subsetFont(ttf, text, { targetFormat: "woff2" }));
	const file = join(OUT_DIR, `${s.name}.woff2`);
	writeFileSync(file, out);
	total += out.length;
	// unicode-range：把字符集压缩成连续区间
	const cps = [...s.chars].map((c) => c.codePointAt(0)).sort((a, b) => a - b);
	const ranges = [];
	for (const cp of cps) {
		const last = ranges[ranges.length - 1];
		if (last && cp === last[1] + 1) last[1] = cp;
		else ranges.push([cp, cp]);
	}
	const ur = ranges.map(([a, b]) => (a === b ? `U+${a.toString(16).toUpperCase()}` : `U+${a.toString(16).toUpperCase()}-${b.toString(16).toUpperCase()}`)).join(",");
	manifest.push({ file: `${s.name}.woff2`, glyphs: s.chars.size, bytes: out.length, unicodeRange: ur });
	console.log(`${s.name}: ${s.chars.size} 字 → ${(out.length / 1024).toFixed(1)}KB`);
}
writeFileSync(join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 1));

console.log(`\n合计 ${shards.length} 片 / ${(total / 1024).toFixed(0)}KB（源 ${(src.length / 1024).toFixed(0)}KB）`);
console.log("注意：分片总量必然大于源文件（每片有独立表结构），收益来自「按需只下载所需片」。");

// ---------- 4) 生成手写 @font-face（unicode-range 分片）----------
const FAMILY = "Fangzheng ZhuZi A Yuan B";
const css = [
	"/* 由 scripts/fonts/shard-cjk.mjs 生成，请勿手改；字体分片加载：浏览器按 unicode-range 只取所需片 */",
	":root {",
	`\t--font-fangzheng-zizhu: "Fangzheng ZhuZi A Yuan B", "Fangzheng ZhuZi A Yuan B fallback: Arial", sans-serif;`,
	"}",
	// 度量兜底字体：与 Astro Font API 原先生成的一致，保证 swap 前后行盒尺寸稳定（CLS）
	`@font-face {
\tfont-family: "Fangzheng ZhuZi A Yuan B fallback: Arial";
\tsrc: local("Arial");
\tfont-display: swap;
\tfont-weight: 400;
\tfont-style: normal;
\tsize-adjust: 107.7766%;
\tascent-override: 96.7714%;
\tdescent-override: 24.6459%;
\tline-gap-override: 0%;
}`,
	...manifest.map((m) => `@font-face {
\tfont-family: "Fangzheng ZhuZi A Yuan B";
\tfont-style: normal;
\tfont-weight: 400;
\tfont-display: swap;
\tsrc: url("../../../assets/fonts/shards/${m.file}") format("woff2");
\tunicode-range: ${m.unicodeRange};
}`),
	"",
].join("\n");
writeFileSync(CSS_OUT, css);
console.log(`CSS 已写入 ${CSS_OUT}（${manifest.length} 段 @font-face）`);

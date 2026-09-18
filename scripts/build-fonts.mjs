// 方正筑紫A圆体B 字体分片脚本：woff2 → ttf → cn-font-split unicode-range 分片
// 产物：public/fonts/fangzheng/（result.css + 分片 woff2），随 public 拷贝进 dist
// 运行：pnpm fonts:build（依赖 devDependencies: cn-font-split、wawoff2）
import fs from "node:fs";
import path from "node:path";
import { fontSplit } from "cn-font-split";
import { decompress as woff2Decompress } from "wawoff2";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const SRC = path.join(ROOT, "src/assets/fonts/FangzhengZhuZiA-YuanB.woff2");
const OUT = path.join(ROOT, "public/fonts/fangzheng");

const woff2 = fs.readFileSync(SRC);
const ttf = new Uint8Array(await woff2Decompress(woff2));
console.log(`[fonts] woff2 ${woff2.length}B → ttf ${ttf.length}B`);

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

await fontSplit({
	input: ttf,
	outDir: OUT,
	css: {
		// font-family 与 fontConfig 的 cssVariable 语义对应（FontSetup 定义变量指向此名）
		fontFamily: "Fangzheng ZhuZi A Yuan B",
		fontDisplay: "swap",
		commentUnicodes: false,
		compress: true,
	},
	reduceMins: true,
	testHtml: false,
	reporter: false,
	renameOutputFont: "[hash:6].[ext]",
	silent: true,
});

// 清理 cn-font-split 的元数据产物（proto/reporter 非运行时所需）
for (const junk of ["index.proto", "reporter.bin"])
	fs.rmSync(path.join(OUT, junk), { force: true });

const files = fs.readdirSync(OUT);
const css = files.find((f) => f.endsWith(".css"));
const woff2s = files.filter((f) => f.endsWith(".woff2"));
const total = woff2s.reduce((s, f) => s + fs.statSync(path.join(OUT, f)).size, 0);
console.log(`[fonts] 分片 ${woff2s.length} 个，总 ${total}B，CSS: ${css}`);

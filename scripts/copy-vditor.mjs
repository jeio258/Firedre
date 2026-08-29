// 构建后：复制 Vditor 运行时所需资源到 dist/vditor/dist（本地 cdn，避免 unpkg 被墙/慢）
import { cpSync, mkdirSync } from "node:fs";

const src = "node_modules/vditor/dist";
const dest = "dist/vditor/dist";
mkdirSync(dest, { recursive: true });

const paths = [
	"css",
	"images",
	"js/i18n",
	"js/icons",
	"js/highlight.js",
	"js/katex",
	"js/lute",
];
for (const p of paths) {
	try {
		cpSync(`${src}/${p}`, `${dest}/${p}`, { recursive: true });
		console.log(`[copy-vditor] copied ${p}`);
	} catch (e) {
		console.error(`[copy-vditor] skip ${p}: ${e.message}`);
	}
}
console.log("[copy-vditor] done");

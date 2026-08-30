// 构建后：复制 Vditor 完整运行时资源到 public/vditor/dist（本地 cdn，避免在线 CDN 慢/被墙）。
// public/vditor 会在 Astro build 时自动复制到 dist，dev 与生产均可通过 /vditor/dist/... 访问。
import { cpSync, mkdirSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const src = "node_modules/vditor/dist";
const targets = ["public/vditor/dist", "dist/vditor/dist"];

// 需要复制的子目录
const subdirs = ["css", "images", "js", "ts", "types"];
// 根目录下需要复制的文件（编辑器运行必需：主样式、主 JS、method 库等）
const rootFiles = ["index.css", "index.js", "index.min.js", "method.js", "method.min.js", "index.d.ts", "method.d.ts"];

if (!existsSync(src)) {
	console.error("[copy-vditor] source missing:", src);
	process.exit(1);
}

for (const dest of targets) {
	mkdirSync(dest, { recursive: true });
	// 子目录整体复制
	for (const d of subdirs) {
		try {
			if (existsSync(join(src, d))) {
				cpSync(join(src, d), join(dest, d), { recursive: true });
				console.log(`[copy-vditor] copied ${d} -> ${dest}`);
			}
		} catch (e) {
			console.error(`[copy-vditor] skip ${d}: ${e.message}`);
		}
	}
	// 根文件复制
	for (const f of rootFiles) {
		try {
			if (existsSync(join(src, f))) {
				cpSync(join(src, f), join(dest, f));
			}
		} catch (e) {
			console.error(`[copy-vditor] skip ${f}: ${e.message}`);
		}
	}
	// 输出体积估算
	let size = 0;
	const walk = (dir) => {
		for (const ent of readdirSync(dir)) {
			const p = join(dir, ent);
			if (statSync(p).isDirectory()) walk(p);
			else size += statSync(p).size;
		}
	};
	try {
		walk(dest);
		console.log(`[copy-vditor] ${dest} total ${(size / 1024 / 1024).toFixed(1)} MiB`);
	} catch {}
}
console.log("[copy-vditor] done");

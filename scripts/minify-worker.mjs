#!/usr/bin/env node
// ⑥ 构建收尾：压缩 Cloudflare Pages 的 _worker.js（advanced mode 目录形态）。
// astro/vite 的 SSR 产物默认不压缩（dist/_worker.js/index.js 约 4.5MB 源码）。
// 用 esbuild transform（非 bundle）→ 保留 import "cloudflare:workers"/"node:*" 等外部导入不变。
// 收益：上传体积、Worker 解析与冷启动（线上另有 br/gzip，带宽收益有限）。
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { transformSync } from "esbuild";

const workerFile = fileURLToPath(
	new URL("../dist/_worker.js/index.js", import.meta.url),
);

let src;
try {
	src = readFileSync(workerFile, "utf8");
} catch {
	console.error(
		"[minify-worker] ✗ 未找到 dist/_worker.js/index.js（构建产物结构可能已变）",
	);
	process.exit(1);
}

const out = transformSync(src, {
	minify: true,
	keepNames: true, // 保留函数/类 .name，避免依赖 name 的代码被压坏
	format: "esm",
	target: "esnext",
	legalComments: "none",
}).code;

const mb = (n) => `${(n / 1024 / 1024).toFixed(2)} MB`;

if (out.length >= src.length) {
	console.log(`[minify-worker] 压缩无收益，保留原文件（${mb(src.length)}）`);
	process.exit(0);
}

writeFileSync(workerFile, out);
statSync(workerFile); // 触发写入落盘校验
console.log(
	`[minify-worker] ✓ _worker.js/index.js ${mb(src.length)} → ${mb(out.length)}` +
		`（-${(100 - (out.length / src.length) * 100).toFixed(0)}%）`,
);

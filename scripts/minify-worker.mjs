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
	// ⚠ 切勿开启 keepNames：它会把类字段改写为 `static{}` 块，并在其中注入
	// `Object.defineProperty(x, "name", …)`；本项目的产物流在 Cloudflare **发布阶段**
	// 执行这些静态初始化块时会抛
	//   TypeError: Object.defineProperty called on non-object
	// 直接导致 Function 发布失败（2026-10-08 线上事故）。
	// 下方有断言兜底：一旦产物凭空多出 static 块，构建立即失败而不是把坏 worker 发上线。
	format: "esm",
	target: "esnext",
	legalComments: "none",
}).code;

// 兜底断言：本项目的上游产物（astro build）**没有**任何 static 块；
// 压缩后若出现 static 块，几乎必然是 keepNames 类改写回归 → 中止构建。
const staticBlocks = (out.match(/static\s*\{/g) || []).length;
if (staticBlocks > 0) {
	console.error(
		`[minify-worker] ✗ 压缩后出现 ${staticBlocks} 个 static 块（keepNames 的典型副作用），` +
			"在 Cloudflare 发布阶段可能抛 Object.defineProperty 错误；已中止构建。",
	);
	process.exit(1);
}

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

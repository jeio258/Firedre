#!/usr/bin/env node
/**
 * 修复 @astrojs/cloudflare v12 + Astro 7 的 Pages _worker.js 兼容性问题：
 *
 * 1. Astro 7 构建的 manifest 以占位符 "@@ASTRO_MANIFEST_REPLACE@@" 注入，
 *    v12 适配器（面向 Astro 5/6）不会执行替换 → 路由表为空 → 全站 404。
 *    解决方案：将 scripts/firedre-manifest.json（由 v14 构建提取的完整 manifest）
 *    直接替换占位符。
 *
 * 2. manifest 中的 rootDir/srcDir 等是构建机绝对路径，
 *    workerd 的 new URL('/abs/path') 会抛 "Invalid URL string"。
 *    统一补一个 file:// base 使其可解析（运行时这些字段不被用于文件系统访问）。
 *
 * 3. Astro 7 BaseApp 读取 manifest.base，v12 生成的 manifest 缺少该字段时兜底为 "/"。
 *
 * 注意：新增/删除页面或路由后，需重新生成 scripts/firedre-manifest.json：
 *   pnpm build:manifest  （临时用 v14 适配器构建并提取）
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const file = join(root, "dist", "_worker.js", "index.js");
const manifestFile = join(root, "scripts", "firedre-manifest.json");

if (!existsSync(file)) {
	console.error(
		"[patch-pages-worker] dist/_worker.js/index.js 不存在，请先构建",
	);
	process.exit(1);
}

let code = readFileSync(file, "utf8");
let changed = 0;

// 1. manifest 占位符替换
if (code.includes("@@ASTRO_MANIFEST_REPLACE@@")) {
	if (!existsSync(manifestFile)) {
		console.error(
			`[patch-pages-worker] 缺少 ${manifestFile}，请先运行 pnpm build:manifest`,
		);
		process.exit(1);
	}
	const manifestJson = readFileSync(manifestFile, "utf8").trim();
	code = code
		.split('deserializeManifest("@@ASTRO_MANIFEST_REPLACE@@")')
		.join(`deserializeManifest(${manifestJson})`);
	changed++;
	console.log(
		`[patch-pages-worker] injected manifest (${manifestJson.length} chars)`,
	);
}

// 2. manifest URL 字段补 base
const fields = [
	"rootDir",
	"srcDir",
	"publicDir",
	"outDir",
	"cacheDir",
	"buildClientDir",
	"buildServerDir",
];
for (const field of fields) {
	const from = `new URL(serializedManifest.${field})`;
	const to = `new URL(serializedManifest.${field}, "file:///")`;
	if (code.includes(from)) {
		code = code.split(from).join(to);
		changed++;
	}
}

// 3. 相对 fetch 修复：SSR 页面/API 使用 fetch("/api/...")，Worker 运行时要求绝对 URL。
//    在 fetch handler 内以请求 URL 为 base 包装全局 fetch。
const fetchFixFrom = "const fetch = async (request, env, context) => {";
const fetchFixTo = `const fetch = async (request, env, context) => {
		const __baseUrl = new URL(request.url);
		const __origFetch = globalThis.fetch;
		globalThis.fetch = (input, init) => {
			if (typeof input === "string" && (input.startsWith("/"))) {
				return __origFetch(new URL(input, __baseUrl), init);
			}
			return __origFetch(input, init);
		};`;
if (code.includes(fetchFixFrom) && !code.includes("__baseUrl")) {
	code = code.split(fetchFixFrom).join(fetchFixTo);
	changed++;
}

// 4. manifest.base 兜底
const baseFrom = "removeTrailingForwardSlash(manifest.base)";
if (code.includes(baseFrom)) {
	code = code
		.split(baseFrom)
		.join('removeTrailingForwardSlash(manifest.base ?? "/")');
	changed++;
}

if (changed > 0) {
	writeFileSync(file, code, "utf8");
	console.log(`[patch-pages-worker] patched (${changed} change(s))`);
} else {
	console.log("[patch-pages-worker] nothing to patch");
}

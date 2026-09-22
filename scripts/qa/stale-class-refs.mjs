#!/usr/bin/env node
// 防回归门禁：JS/Svelte/Astro 里「字符串形式」的类选择器必须能在样式语料中找到定义。
// 背景：2026-09-21 阶段2 改名把 markup 的 .dynamic-page 改为 .page-shell，
// 但 DynamicFeed.svelte 里 list.closest(".dynamic-page") 漏改 → 动态流静默不渲染。
// 本检查只盯项目命名空间（page-* / dynamic-*），避免与 Tailwind 工具类误报。
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("../..", import.meta.url).pathname;
const SRC = join(ROOT, "src");

function walk(dir, extRe, acc = []) {
	for (const e of readdirSync(dir)) {
		const p = join(dir, e);
		if (statSync(p).isDirectory()) {
			walk(p, extRe, acc);
		} else if (extRe.test(e)) {
			acc.push(p);
		}
	}
	return acc;
}

// 样式语料：src/styles/** + 组件 <style> 块（Astro/Svelte）
// 组件文件只取 <style> 块——否则 JS 里的选择器字符串自己进语料（自证循环，灵敏度测试失效）
function cssCorpus() {
	const files = [
		...walk(join(SRC, "styles"), /\.(css|styl)$/),
		...walk(SRC, /\.(astro|svelte)$/),
	];
	const corpus = new Set();
	const selRe = /([.#])(page|dynamic)-[a-z0-9-]+/g;
	for (const f of files) {
		let t = readFileSync(f, "utf8");
		if (!f.startsWith(join(SRC, "styles"))) {
			t = [...t.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)]
				.map((m) => m[1])
				.join("\n");
		}
		for (const m of t.matchAll(selRe)) corpus.add(m[0]);
	}
	return corpus;
}

// 字符串选择器里的类 token（token 必须用完整匹配 cm[0]）
function refsInScripts() {
	const files = walk(SRC, /\.(ts|mjs|svelte|astro)$/);
	const selRe =
		/(?:querySelector|querySelectorAll|closest|matches|getElementById)\s*\(\s*[`"']([^`"']+)[`"']/g;
	const out = [];
	for (const f of files) {
		const t = readFileSync(f, "utf8");
		for (const m of t.matchAll(selRe)) {
			for (const cm of m[1].matchAll(/\.(page|dynamic)-[a-z0-9-]+/g)) {
				out.push({ file: f.replace(ROOT + "/", ""), token: cm[0] });
			}
		}
	}
	return out;
}

const corpus = cssCorpus();
const refs = refsInScripts();
// 允许列表：确为运行时动态拼接/无样式但属语义属性的可放这里（当前为空）
const ALLOW = new Set([]);
const stale = refs.filter((r) => !corpus.has(r.token) && !ALLOW.has(r.token));

if (stale.length) {
	console.log("FAIL  字符串选择器引用了未定义的类名（疑似改名残留）:");
	for (const s of stale) console.log(`      ${s.file}: ${s.token}`);
	process.exit(1);
}
console.log(
	`PASS  字符串选择器类名均在样式语料中（扫描 ${refs.length} 处引用 / 语料 ${corpus.size} 条）`,
);

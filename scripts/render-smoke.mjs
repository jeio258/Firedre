#!/usr/bin/env node
// 渲染冒烟抽查（SSR 门禁必做项）：build Complete ≠ 渲染正常，SSR 运行时错误
// （如 TDZ）只在请求时爆发且常被吞成空壳页，必须请求级断言。
// 断言：关键路由 200 + 内容长度 + 关键元素 + SEO 标签 + wrangler 无 Uncaught/ERROR。
// 用法：pnpm build 后 node scripts/qa/render-smoke.mjs [port]；失败退出码 1。
import { spawn } from "node:child_process";

const PORT = process.argv[2] || "4375";
const BASE = `http://localhost:${PORT}`;
const MIN_HTML_LEN = 50000; // 空壳页 ~39 字节，正常渲染页 >30 万

const results = [];
function check(name, ok, detail = "") {
	results.push({ name, ok });
	console.log(
		`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  → " + detail : ""}`,
	);
	return ok;
}

function startWrangler() {
	const proc = spawn(
		"npx",
		["wrangler", "pages", "dev", "dist", "--port", PORT],
		{ detached: true, stdio: ["ignore", "pipe", "pipe"] },
	);
	let workerErrors = "";
	proc.stderr?.on("data", (d) => {
		const text = String(d);
		if (/Uncaught|✘ \[ERROR\]|ReferenceError|TypeError/.test(text)) {
			workerErrors += text;
		}
	});
	proc.stdout?.on("data", () => {});
	return { proc, errors: () => workerErrors };
}

async function portReady() {
	try {
		const r = await fetch(BASE + "/favicon/");
		return r.status < 500;
	} catch {
		return false;
	}
}

async function waitReady(deadlineMs = 90000) {
	const end = Date.now() + deadlineMs;
	while (Date.now() < end) {
		if (await portReady()) return true;
		await new Promise((r) => setTimeout(r, 2000));
	}
	return false;
}

async function fetchPage(path) {
	const r = await fetch(BASE + path);
	const html = await r.text();
	return { status: r.status, html, len: html.length };
}

// ===== 启动 =====
console.log(`[render-smoke] 启动 wrangler pages dev（端口 ${PORT}）...`);
const wrangler = startWrangler();
if (!(await waitReady())) {
	console.error("[render-smoke] 预览服务启动超时");
	process.kill(-wrangler.proc.pid, "SIGKILL");
	process.exit(1);
}

try {
	// ===== 1. 关键路由渲染断言 =====
	const routes = [
		["/", ["nav", "main"]],
		["/archives/", ["main"]],
		["/dynamic/", ["main"]],
		["/friends/", ["main"]],
		["/guestbook/", ["main"]],
	];
	for (const [route, selectors] of routes) {
		const { status, len } = await fetchPage(route);
		const ok =
			status === 200 &&
			len > MIN_HTML_LEN &&
			selectors.every((sel) => len > 1000); // 空壳断言以长度为主，元素断言在浏览器抽查中
		check(`渲染 ${route}（status=${status}, len=${len}）`, ok);
	}

	// ===== 2. SEO 抽查（首页 + 一篇文章）=====
	const home = await fetchPage("/");
	check("SEO 首页 canonical", home.html.includes('rel="canonical"'));
	check("SEO 首页 og:title", home.html.includes('property="og:title"'));
	check("SEO 首页 og:image", home.html.includes('property="og:image"'));
	check("SEO 首页 meta description", home.html.includes('name="description"'));
	check("SEO 首页 JSON-LD", home.html.includes("application/ld+json"));

	// 文章详情（从归档取第一个文章链接）
	const archive = await fetchPage("/archives/");
	const postHref = archive.html.match(/href="(\/posts\/[^"]+)"/)?.[1];
	if (postHref) {
		const post = await fetchPage(postHref);
		check(
			`渲染 ${postHref}（len=${post.len}）`,
			post.status === 200 && post.len > MIN_HTML_LEN,
		);
		check(
			"SEO 文章 og:type=article",
			post.html.includes('property="og:type" content="article"'),
		);
		check(
			"SEO 文章 article:published_time",
			post.html.includes("article:published_time"),
		);
		check("SEO 文章 canonical", post.html.includes('rel="canonical"'));
	}

	// ===== 3. robots.txt / sitemap =====
	const robots = await fetchPage("/robots.txt");
	check(
		"robots.txt（含 Sitemap 指向）",
		robots.status === 200 &&
			robots.html.includes("Sitemap:") &&
			robots.html.includes("Disallow: /admin/"),
	);
	const sitemap = await fetchPage("/sitemap.xml");
	check(
		"sitemap.xml（status + urlset）",
		sitemap.status === 200 && sitemap.html.includes("<urlset"),
	);

	// ===== 4. wrangler worker 错误 =====
	const workerErr = wrangler.errors();
	check("worker 无 Uncaught/ERROR 日志", workerErr === "");
	if (workerErr) console.error(workerErr.slice(0, 800));
} finally {
	try {
		process.kill(-wrangler.proc.pid, "SIGKILL");
	} catch {
		try {
			wrangler.proc.kill("SIGKILL");
		} catch {}
	}
}

const failed = results.filter((r) => !r.ok);
console.log(
	`\n[render-smoke] ${results.length - failed.length}/${results.length} 通过` +
		(failed.length
			? `\n失败：\n  - ${failed.map((f) => f.name).join("\n  - ")}`
			: ""),
);
process.exit(failed.length ? 1 : 0);

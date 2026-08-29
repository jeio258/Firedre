/**
 * Firedre 真实前端 UI 审查 v2（Playwright chromium）
 *
 * 针对本地 dev 服务器做真实渲染 + 交互 + 响应式 + 语义检查。
 * 修正自 v1：更准确的项目选择器、try/catch 防崩溃、真实 404 验证。
 *
 * 运行：
 *   SITE_URL=http://localhost:4321 node scripts/ui-review.cjs
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const BASE = process.env.SITE_URL || "http://localhost:4321";
const SHOT_DIR = process.env.SHOT_DIR || "/tmp/firedre-review";
fs.mkdirSync(SHOT_DIR, { recursive: true });

(async () => {
	const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
	let pass = 0,
		fail = 0;
	const issues = [];

	const ok = (name, cond, extra = "") => {
		cond ? pass++ : fail++;
		console.log(`${cond ? "✅" : "❌"} ${name}${extra ? " - " + extra : ""}`);
	};
	const uniqPush = (arr, v) => !arr.includes(v) && arr.push(v);

	// 记录 JS 错误（挂到 page 上）
	const hookErrors = (page) => {
		page.on("pageerror", (e) => uniqPush(issues, `[pageerror] ${page.url()} :: ${e.message}`));
		page.on("console", (m) => {
			if (m.type() === "error") uniqPush(issues, `[console:error] ${page.url()} :: ${m.text()}`);
		});
	};

	const goto = async (page, p) => {
		for (let i = 0; i < 3; i++) {
			try {
				const resp = await page.goto(BASE + p, { waitUntil: "networkidle", timeout: 45000 });
				await page.waitForTimeout(900);
				return resp;
			} catch (e) {
				await page.waitForTimeout(2000);
			}
		}
		return null;
	};

	// ---------------- 桌面视口：主要公开页渲染 + 语义检查 ----------------
	{
		console.log("\n=== 桌面视口 · 主要页面渲染 ===");
		const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
		const page = await ctx.newPage();
		hookErrors(page);

		const visit = async (p, label, expectTitle) => {
			try {
				const resp = await goto(page, p);
				ok(`${label} status 200`, resp && resp.status() === 200, resp ? String(resp.status()) : "no resp");
				const doc = await page.evaluate(() => {
					const navbar = document.querySelector("#navbar, #navbar-wrapper");
					const foot = document.querySelector(".footer, footer");
					return {
						title: document.title,
						lang: document.documentElement.lang,
						hasMain: !!document.querySelector("main"),
						navLinks: Array.from(document.querySelectorAll("#navbar a, #nav-menu-panel a")).filter((a) => a.offsetParent !== null).length,
						hasFooter: !!foot,
						footerText: (foot && foot.innerText.trim()) || "",
						textLen: (document.body.innerText || "").trim().length,
						imgsNoAlt: Array.from(document.images).filter((i) => !i.alt && !(i.src || "").startsWith("data:")).length,
					};
				});
				ok(`${label} has main`, doc.hasMain);
				ok(`${label} nav links`, doc.navLinks >= 3, `${doc.navLinks}`);
				ok(`${label} has footer`, doc.hasFooter && doc.footerText.length > 0);
				ok(`${label} content`, doc.textLen > 60, `${doc.textLen} chars`);
				ok(`${label} lang`, !!doc.lang, doc.lang || "(missing)");
				ok(`${label} imgs alt`, doc.imgsNoAlt === 0, `${doc.imgsNoAlt} no-alt`);
				if (expectTitle) ok(`${label} title`, doc.title.includes(expectTitle), doc.title);
				await page.screenshot({ path: path.join(SHOT_DIR, `${label}-desktop.png`), fullPage: false });
			} catch (e) {
				ok(`${label} loaded`, false, e.message);
			}
		};

		await visit("/", "home", "Firefly");
		await visit("/archive/", "archive");
		await visit("/search/", "search");
		await visit("/about/", "about");
		await visit("/friends/", "friends");
		await visit("/guestbook/", "guestbook");
		await visit("/gallery/", "gallery");
		await visit("/tags/", "tags");
		await visit("/categories/", "categories");
		await visit("/dynamic/", "dynamic");

		// 真实 404 语义：不存在的路径
		try {
			const resp = await goto(page, "/no-such-page-abc123/");
			const s = resp ? resp.status() : 0;
			ok("nonexistent path returns 404", s === 404, `got ${s}`);
			await page.screenshot({ path: path.join(SHOT_DIR, "404-route.png") });
		} catch (e) {
			ok("nonexistent path returns 404", false, e.message);
		}
		await ctx.close();
	}

	// ---------------- 交互：导航 + 搜索 ----------------
	{
		console.log("\n=== 交互 · 导航与搜索 ===");
		const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
		const page = await ctx.newPage();
		hookErrors(page);
		await goto(page, "/");

		const about = page.locator('#navbar a[href*="about"], #nav-menu-panel a[href*="about"]').first();
		if ((await about.count()) > 0) {
			await about.click().catch(() => {});
			await page.waitForTimeout(1800);
			ok("nav click navigates", page.url().includes("about"), page.url().replace(BASE, ""));
			await page.screenshot({ path: path.join(SHOT_DIR, "after-nav-click.png") });
		} else {
			ok("nav click navigates", false, "no about nav link");
		}

		// 搜索：选择可见输入
		await goto(page, "/search/");
		const visibleInput = page.locator("input:visible").first();
		if ((await visibleInput.count()) > 0) {
			try {
				await visibleInput.fill("demo");
				await visibleInput.press("Enter");
				await page.waitForTimeout(1500);
				ok("search input interactive", true, "filled 'demo' + Enter");
				await page.screenshot({ path: path.join(SHOT_DIR, "search-result.png") });
			} catch (e) {
				ok("search input interactive", false, e.message);
			}
		} else {
			ok("search input interactive", false, "no visible input");
		}
		await ctx.close();
	}

	// ---------------- 移动端视口：渲染 + 溢出 ----------------
	{
		console.log("\n=== 移动端视口 (375px) ===");
		const ctx = await browser.newContext({
			viewport: { width: 375, height: 812 },
			isMobile: true,
			hasTouch: true,
		});
		const page = await ctx.newPage();
		hookErrors(page);
		for (const [label, p] of [
			["home-mobile", "/"],
			["archive-mobile", "/archive/"],
			["gallery-mobile", "/gallery/"],
		]) {
			await goto(page, p);
			const overflow = await page.evaluate(
				() => document.documentElement.scrollWidth - document.documentElement.clientWidth,
			);
			ok(`${label} no horizontal overflow`, overflow <= 1, `${overflow}px overflow`);
			await page.screenshot({ path: path.join(SHOT_DIR, `${label}.png`) });
		}
		await ctx.close();
	}

	// ---------------- 后台登录 UI ----------------
	{
		console.log("\n=== 后台登录页 ===");
		const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
		const page = await ctx.newPage();
		hookErrors(page);
		try {
			const resp = await goto(page, "/admin/");
			ok("admin status 200", resp && resp.status() === 200, resp ? String(resp.status()) : "");
			const inputs = await page.locator("input:visible").count();
			ok("admin has inputs", inputs >= 2, `${inputs} visible inputs`);
			const buttons = await page.locator("button").count();
			ok("admin has buttons", buttons > 0, `${buttons} buttons`);
			if (inputs >= 2) {
				try {
					await page.locator("input:visible").nth(0).fill("testuser");
					await page.locator("input:visible").nth(1).fill("testpass");
					const v = await page.locator("input:visible").nth(0).inputValue();
					ok("admin inputs interactive", v === "testuser", `user="${v}"`);
				} catch (e) {
					ok("admin inputs interactive", false, e.message);
				}
			}
			await page.screenshot({ path: path.join(SHOT_DIR, "admin-login.png") });
		} catch (e) {
			ok("admin loaded", false, e.message);
		}
		await ctx.close();
	}

	// ---------------- 汇总 ----------------
	console.log("\n=== JS console/page errors ===");
	if (!issues.length) {
		console.log("  (none) ✅");
	} else {
		issues.slice(0, 25).forEach((i) => console.log("  ⚠️  ", i));
		console.log(`  ... ${issues.length} unique`);
	}
	console.log(`\n=== ${pass}/${pass + fail} checks passed | ${issues.length} unique JS issues ===`);
	console.log(`截图: ${SHOT_DIR}`);
	await browser.close();
	process.exit(fail ? 1 : 0);
})();

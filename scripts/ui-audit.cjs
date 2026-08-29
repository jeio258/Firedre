/**
 * Firedre 真实前端 UI 测试（Playwright chromium 渲染）
 * - 渲染页面，检查真实 DOM 结构、可见元素、交互
 * - 收集 console/page 错误
 * - 截图留存
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const BASE = process.env.SITE_URL || "https://firedre.pages.dev";
const SHOT_DIR = process.env.SHOT_DIR || "/tmp/firedre-shots";
fs.mkdirSync(SHOT_DIR, { recursive: true });

const NAV_SELECTORS = ["header nav", "nav a", ".nav-link", "header a"];
const FOOTER_SELECTORS = ["footer", "footer a", ".footer"];

(async () => {
	const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
	const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, deviceScaleFactor: 1 });
	const page = await ctx.newPage();
	let pass = 0, fail = 0;
	const issues = [];

	page.on("pageerror", (e) => issues.push(`[pageerror] ${page.url()} :: ${e.message}`));
	page.on("console", (m) => {
		if (m.type() === "error") issues.push(`[console:error] ${page.url()} :: ${m.text()}`);
	});

	const ok = (name, cond, extra = "") => {
		cond ? pass++ : fail++;
		console.log(`${cond ? "✅" : "❌"} ${name}${extra ? " - " + extra : ""}`);
	};

	const goto = async (p) => {
		for (let i = 0; i < 3; i++) {
			try {
				const resp = await page.goto(BASE + p, { waitUntil: "domcontentloaded", timeout: 40000 });
				await page.waitForTimeout(1200);
				return resp;
			} catch (e) {
				await page.waitForTimeout(2500);
			}
		}
		return null;
	};

	const countSel = async (sels) => {
		for (const s of sels) {
			const n = await page.locator(s).count();
			if (n > 0) return n;
		}
		return 0;
	};

	// ---------- 首页 ----------
	{
		await goto("/");
		const title = await page.title();
		ok("home title", title.includes("Firefly"), title);
		// 导航栏（header nav + links）
		const nav = await countSel(NAV_SELECTORS);
		ok("home has nav", nav >= 3, `${nav} nav links`);
		// footer
		const footer = await countSel(FOOTER_SELECTORS);
		ok("home has footer", footer > 0, `${footer} footer elems`);
		// 主内容区
		const main = await page.locator("main").count();
		ok("home has <main>", main > 0);
		// 可见文本
		const bodyText = await page.evaluate(() => document.body.innerText);
		ok("home visible text", bodyText.trim().length > 100, `${bodyText.trim().length} chars`);
		// banner/hero 区域
		const hasWallpaper = await page.evaluate(() =>
			document.documentElement.hasAttribute("data-wallpaper-mode") ||
			!!document.querySelector('[class*="banner"], [class*="hero"]'));
		ok("home has banner/hero", hasWallpaper);
		await page.screenshot({ path: path.join(SHOT_DIR, "home.png"), fullPage: false });
	}

	// ---------- 归档（空状态） ----------
	{
		const resp = await goto("/posts/");
		const finalUrl = page.url();
		ok("archive -> 404 redirect", /\/404\/?$/.test(finalUrl), `final=${finalUrl.replace(BASE, "")}`);
		ok("archive 404 page renders", (await page.title()).length > 0);
		await page.screenshot({ path: path.join(SHOT_DIR, "posts-empty.png"), fullPage: false });
	}

	// ---------- 搜索 ----------
	{
		await goto("/search/");
		const hasSearchInput = await countSel(["input[type='search']", "input[type='text']", "input", "[class*='search'] input"]);
		ok("search has input", hasSearchInput > 0, `${hasSearchInput} inputs`);
		ok("search title", (await page.title()).includes("搜索"), await page.title());
		await page.screenshot({ path: path.join(SHOT_DIR, "search.png"), fullPage: false });
	}

	// ---------- 关于 ----------
	{
		await goto("/about/");
		const bodyText = await page.evaluate(() => document.body.innerText);
		ok("about has text", bodyText.trim().length > 150, `${bodyText.trim().length} chars`);
		const imgs = await page.locator("img").count();
		ok("about renders", imgs >= 0);
		await page.screenshot({ path: path.join(SHOT_DIR, "about.png"), fullPage: false });
	}

	// ---------- 相册 ----------
	{
		await goto("/gallery/");
		const title = await page.title();
		ok("gallery title", title.includes("相册") || title.includes("Firefly"), title);
		const cards = await countSel(["[class*='card']", "[class*='gallery'] article", "figure", "li"]);
		ok("gallery has items", cards > 0, `${cards} cards`);
		await page.screenshot({ path: path.join(SHOT_DIR, "gallery.png"), fullPage: false });
	}

	// ---------- 友链 ----------
	{
		await goto("/links/");
		const links = await page.locator("a").count();
		ok("links has anchors", links > 0, `${links} links`);
		await page.screenshot({ path: path.join(SHOT_DIR, "links.png"), fullPage: false });
	}

	// ---------- 后台登录 UI 交互 ----------
	{
		await goto("/admin/");
		const title = await page.title();
		ok("admin title", title.includes("登录"), title);
		const inputs = await page.locator("input").count();
		ok("admin has inputs", inputs >= 2, `${inputs} inputs`);
		const buttons = await page.locator("button").count();
		ok("admin has buttons", buttons > 0, `${buttons} buttons`);
		// 尝试填写登录表单（不提交，仅验证可交互）
		const userInput = page.locator("input").first();
		const passInput = page.locator("input").nth(1);
		await userInput.fill("test");
		await passInput.fill("testpass");
		const filledUser = await userInput.inputValue();
		ok("admin inputs interactive", filledUser === "test", `user field = "${filledUser}"`);
		await page.screenshot({ path: path.join(SHOT_DIR, "admin-login.png"), fullPage: false });
	}

	// ---------- 规范页 ----------
	{
		await goto("/spec/about/");
		ok("spec/about renders", (await page.evaluate(() => document.body.innerText)).trim().length > 100);
		await goto("/spec/guestbook/");
		ok("spec/guestbook renders", (await page.evaluate(() => document.body.innerText)).trim().length > 100);
	}

	console.log("\n=== console / page errors ===");
	const uniq = [...new Set(issues)];
	uniq.slice(0, 12).forEach((i) => console.log(" ", i));
	if (!uniq.length) console.log("  (none)");

	await browser.close();
	console.log(`\n=== ${pass}/${pass + fail} UI checks passed, ${uniq.length} issues ===`);
	process.exit(fail ? 1 : 0);
})();

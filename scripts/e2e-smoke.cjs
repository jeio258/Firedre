/**
 * Firedre 无头浏览器 E2E 冒烟测试（Playwright）
 *
 * 验证生产部署的真实行为：首页/后台渲染、无 JS 错误、公开 API 无敏感字段泄露。
 *
 * 运行：
 *   SITE_URL=https://firedre.pages.dev node scripts/e2e-smoke.cjs
 *   SITE_URL=http://localhost:8790 node scripts/e2e-smoke.cjs   # 本地 wrangler dev
 */
const { chromium } = require("playwright");

const BASE = process.env.SITE_URL || "https://firedre.pages.dev";

(async () => {
	const browser = await chromium.launch({
		headless: true,
		args: ["--no-sandbox"],
	});
	const results = [];
	const consoleErrs = [];
	const check = (name, cond, detail = "") => {
		results.push({ name, pass: !!cond });
		console.log(`${cond ? "✅" : "❌"} ${name}${detail ? " - " + detail : ""}`);
	};

	// ---- 1. 首页 ----
	{
		const page = await browser.newPage();
		page.on("console", (m) => {
			if (m.type() === "error") consoleErrs.push({ u: page.url(), m: m.text() });
		});
		page.on("pageerror", (e) =>
			consoleErrs.push({ u: page.url(), m: "PAGEERROR: " + e.message }),
		);
		try {
			const resp = await page.goto(BASE + "/", {
				waitUntil: "networkidle",
				timeout: 60000,
			});
			check(
				"home status 200",
				resp && resp.status() === 200,
				resp ? String(resp.status()) : "no resp",
			);
			const title = await page.title();
			check("home has title", title && title.length > 0, `"${title}"`);
			const body = await page.evaluate(() => document.body.innerText);
			check(
				"home body content",
				body && body.trim().length > 100,
				`${(body || "").length} chars`,
			);
		} catch (e) {
			check("home loaded", false, e.message);
		}
		await page.close();
	}

	// ---- 2. /admin ----
	{
		const page = await browser.newPage();
		page.on("pageerror", (e) =>
			consoleErrs.push({ u: page.url(), m: "PAGEERROR: " + e.message }),
		);
		try {
			const resp = await page.goto(BASE + "/admin/", {
				waitUntil: "networkidle",
				timeout: 60000,
			});
			check(
				"admin status 200",
				resp && resp.status() === 200,
				resp ? String(resp.status()) : "",
			);
			const inputs = await page.locator("input").count();
			check("admin has inputs", inputs > 0, `${inputs} inputs`);
		} catch (e) {
			check("admin loaded", false, e.message);
		}
		await page.close();
	}

	// ---- 3. 公开元数据 API：结构 + 无明文密码泄露 ----
	{
		const page = await browser.newPage();
		try {
			await page.goto(BASE + "/api/allPostMeta.json", {
				waitUntil: "networkidle",
				timeout: 60000,
			});
			const txt = await page.evaluate(() => document.body.innerText);
			let parsed = null;
			try {
				parsed = JSON.parse(txt);
			} catch {}
			check(
				"api allPostMeta is JSON array",
				Array.isArray(parsed),
				Array.isArray(parsed) ? `${parsed.length} items` : txt.slice(0, 80),
			);
			if (Array.isArray(parsed)) {
				const leaked = parsed.filter(
					(p) =>
						p &&
						typeof p.password === "string" &&
						p.password.length > 0 &&
						p.password !== "true" &&
						p.password !== "false",
				);
				check("allPostMeta 无明文密码泄露", leaked.length === 0);
			}
		} catch (e) {
			check("api allPostMeta", false, e.message);
		}
		await page.close();
	}

	// ---- 4. robots ----
	{
		const page = await browser.newPage();
		try {
			const res = await page.goto(BASE + "/robots.txt", {
				timeout: 30000,
			});
			check(
				"robots.txt 200",
				res && res.status() === 200,
				res ? String(res.status()) : "",
			);
		} catch (e) {
			check("robots.txt", false, e.message);
		}
		await page.close();
	}

	check(
		"无页面 JS 错误",
		consoleErrs.length === 0,
		consoleErrs.length ? JSON.stringify(consoleErrs.slice(0, 3)) : "clean",
	);
	console.log("\n=== Errors ===");
	consoleErrs.slice(0, 8).forEach((e) => console.log(" ", e));

	await browser.close();
	const failed = results.filter((r) => !r.pass).length;
	console.log(`\n=== ${results.length - failed}/${results.length} checks passed ===`);
	process.exit(failed ? 1 : 0);
})();

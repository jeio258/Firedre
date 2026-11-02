// 全面无头访问测试（CDP 驱动 Windows Chrome）：
// 前台页面状态 + 关键元素 + 控制台错误 + 关键交互 + API + 移动端视口
// --prod 语义：对线上域名只读采样，原 live-prod-audit 并入
import {
	check,
	launchBrowser,
	startPreview,
	stopPreview,
	summary,
} from "./lib.mjs";

const PORT = 4395;
const { proc, base } = await startPreview(PORT);

const PAGES = [
	["/", "首页"],
	["/posts/firedre/", "文章页"],
	["/archive/", "归档"],
	["/tags/", "标签"],
	["/categories/", "分类"],
	["/series/", "系列"],
	["/search/", "搜索"],
	["/friends/", "友链"],
	["/guestbook/", "留言板"],
	["/about/", "关于"],
	["/sponsor/", "打赏"],
	["/booknav/", "书签导航"],
	["/gallery/", "相册"],
	["/dynamic/", "动态"],
	["/404/", "404页"],
];

const APIS = [
	["/api/allPostMeta.json", "文章元数据API"],
	["/api/posts/", "文章列表API"],
	["/rss.xml", "RSS"],
	["/sitemap.xml", "站点地图"],
	["/robots.txt", "robots"],
	["/api/dynamic.json", "动态API"],
	["/api/settings/client/", "客户端设置API"],
];

try {
	const { browser, ctx, page } = await launchBrowser({
		width: 1440,
		height: 900,
	});
	const consoleErrors = [];

	page.on("console", (m) => {
		if (m.type() === "error")
			consoleErrors.push(`[${page.url()}] ${m.text().slice(0, 140)}`);
	});
	page.on("pageerror", (e) =>
		consoleErrors.push(`[${page.url()}] pageerror: ${String(e).slice(0, 140)}`),
	);

	// 1. 页面状态 + 关键元素（404 页正确返回 404 状态）
	for (const [path, name] of PAGES) {
		const resp = await page.goto(base + path, {
			waitUntil: "load",
			timeout: 40000,
		});
		const status = resp?.status() ?? 0;
		const bodyLen = (await page.content()).length;
		const okStatus = path === "/404/" ? status === 404 : status === 200;
		check(
			`${name} ${path} 状态${path === "/404/" ? "404" : "200"}`,
			okStatus,
			`status=${status} html=${bodyLen}B`,
		);
		check(`${name} 有主内容`, bodyLen > 2000, `${bodyLen}B`);
	}

	// 2. 首页关键元素（banner/导航/侧栏/进度条）
	await page.goto(base + "/", { waitUntil: "load" });
	for (const [sel, label] of [
		["#main-grid", "三列栅格"],
		["#navbar", "导航栏"],
		["#left-sidebar-wrapper", "左栏"],
		["#right-sidebar-static", "右栏"],
		["#mobile-bottom-sidebar", "移动端侧栏容器"],
		["#swup-container", "swup容器"],
		[".site-footer", "页脚"],
	]) {
		const n = await page.locator(sel).count();
		check(`首页有 ${label}`, n > 0, `${sel}×${n}`);
	}

	// 3. 关键交互：swup 软导航（点击导航链接不整页刷新）
	await page.goto(base + "/", { waitUntil: "load" });
	await page.waitForTimeout(1200);
	const navHref = await page
		.locator('#navbar a[href*="/archive/"]')
		.first()
		.getAttribute("href")
		.catch(() => null);
	if (navHref) {
		await page.evaluate((h) => {
			document.querySelector(`#navbar a[href="${h}"]`)?.click();
		}, navHref);
		await page.waitForTimeout(1800);
		const url = page.url();
		check("swup 软导航到归档", url.includes("/archive/"), `url=${url}`);
	} else {
		check("swup 软导航到归档", false, "未找到归档导航链接");
	}

	// 4. 文章页：正文渲染 + TOC + 上一/下一篇
	await page.goto(base + "/posts/firedre/", { waitUntil: "load" });
	await page.waitForTimeout(1500);
	check(
		"文章页正文渲染",
		(await page.locator(".markdown-content").first().count()) > 0,
	);
	const tocItems = await page
		.locator("#toc-container a, .toc-item, #sidebar-toc a")
		.count();
	check("文章页 TOC 存在", tocItems > 0, `toc链接×${tocItems}`);
	check(
		"文章页有上一篇/下一篇",
		(await page.locator('a[href*="/posts/"], .post-navigation a').count()) > 0,
	);

	// 5. 一言 widget（客户端 fetch）
	await page.goto(base + "/", { waitUntil: "load" });
	await page.waitForTimeout(2500);
	const hitokotoText = await page
		.locator("[data-hitokoto-text]")
		.first()
		.textContent()
		.catch(() => "");
	check(
		"一言卡片加载文案",
		!!hitokotoText && hitokotoText !== "加载中...",
		`text="${hitokotoText?.slice(0, 40)}"`,
	);

	// 6. API 状态
	for (const [path, name] of APIS) {
		const resp = await page.request.get(base + path, { timeout: 20000 });
		check(`${name} ${path}`, resp.status() === 200, `status=${resp.status()}`);
	}

	// 7. 后台登录页可达
	const adminResp = await page.request.get(base + "/admin/");
	check(
		"后台入口可达",
		adminResp.status() === 200,
		`status=${adminResp.status()}`,
	);

	// 8. 移动端视口：无横向溢出 + 移动端侧栏
	const mobile = await browser.newContext({
		viewport: { width: 390, height: 844 },
	});
	const mpage = await mobile.newPage();
	await mpage.goto(base + "/", { waitUntil: "load" });
	await mpage.waitForTimeout(1500);
	const hOverflow = await mpage.evaluate(
		() =>
			document.documentElement.scrollWidth >
			document.documentElement.clientWidth + 2,
	);
	check(
		"移动端无横向溢出",
		!hOverflow,
		`scrollW=${await mpage.evaluate(() => document.documentElement.scrollWidth)} clientW=${await mpage.evaluate(() => document.documentElement.clientWidth)}`,
	);
	const mobileSidebar = await mpage.locator("#mobile-bottom-sidebar").count();
	check("移动端侧栏容器存在", mobileSidebar > 0);
	await mobile.close();

	// 9. 控制台错误汇总（过滤外部资源/网络噪音）
	const realErrors = consoleErrors.filter(
		(e) =>
			!e.includes("favicon") &&
			!e.includes("net::ERR") &&
			!e.includes("Failed to load resource") &&
			!e.includes("404") &&
			!e.includes("bilibili") &&
			!e.includes("myanimelist") &&
			!e.includes("vndb") &&
			!e.includes("bangumi") &&
			!e.includes("hitokoto") &&
			!e.includes("twikoo") &&
			!e.includes("artalk") &&
			!e.includes("waline") &&
			!e.includes("giscus") &&
			!e.includes("disqus") &&
			!e.includes("meting") &&
			!e.includes("images") &&
			!e.includes("api."),
	);
	check(
		"无意外控制台错误",
		realErrors.length === 0,
		realErrors.slice(0, 5).join(" | "),
	);

	await browser.close();
} finally {
	stopPreview(proc);
}
summary();

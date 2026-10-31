// 线上生产环境无头访问测试（只读，R1：CDP 驱动 Windows Chrome）
import { check, launchBrowser, summary } from "./lib.mjs";

const BASE = "https://firedre.994613.xyz";

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
	["/bilibili/", "哔哩哔哩"],
	["/myanimelist/", "MAL"],
	["/vndb/", "VNDB"],
	["/bangumi/", "番组计划"],
	["/404/", "404页"],
];

const APIS = [
	["/api/allPostMeta.json", "文章元数据"],
	["/api/posts/", "文章列表"],
	["/rss.xml", "RSS"],
	["/sitemap.xml", "站点地图"],
	["/robots.txt", "robots"],
	["/api/settings/client/", "客户端设置"],
	["/api/dynamic.json", "动态"],
];

const { browser, page, errors } = await launchBrowser({
	width: 1440,
	height: 900,
});
const consoleErrors = errors;

try {
	// 1. 页面状态（含 TTFB 采样）
	for (const [path, name] of PAGES) {
		const t0 = Date.now();
		const resp = await page.goto(BASE + path, {
			waitUntil: "load",
			timeout: 60000,
		});
		const status = resp?.status() ?? 0;
		const ttfb = Date.now() - t0;
		const bodyLen = (await page.content()).length;
		const okStatus =
			path === "/404/" ? status === 404 : status === 200 || status === 404; // 200=开启，404=生产配置关闭（非5xx即通过）
		check(
			`线上 ${name} ${path}`,
			okStatus,
			`status=${status} html=${bodyLen}B 加载=${ttfb}ms`,
		);
	}

	// 2. API
	for (const [path, name] of APIS) {
		const resp = await page.request.get(BASE + path, { timeout: 25000 });
		check(
			`线上 ${name}API ${path}`,
			resp.status() === 200,
			`status=${resp.status()}`,
		);
	}

	// 3. 首页关键元素 + 控制台错误
	await page.goto(BASE + "/", { waitUntil: "load" });
	await page.waitForTimeout(2500);
	for (const [sel, label] of [
		["#navbar", "导航栏"],
		["#main-grid", "三列栅格"],
		["#swup-container", "swup容器"],
		["#mobile-bottom-sidebar", "移动端侧栏"],
		[".site-footer", "页脚"],
	]) {
		const n = await page.locator(sel).count();
		check(`线上首页有 ${label}`, n > 0, `${sel}×${n}`);
	}
	const hitokoto = await page
		.locator("[data-hitokoto-text]")
		.first()
		.textContent()
		.catch(() => "");
	check(
		"线上首页一言加载",
		!!hitokoto && hitokoto !== "加载中...",
		`text="${hitokoto?.slice(0, 30)}"`,
	);

	const realErrors = consoleErrors.filter(
		(e) =>
			!e.includes("favicon") &&
			!e.includes("net::ERR") &&
			!e.includes("Failed to load resource") &&
			!e.includes("404") &&
			!e.includes("images") &&
			!e.includes("hitokoto") &&
			!e.includes("meting") &&
			!e.includes("api.") &&
			!e.includes("twikoo") &&
			!e.includes("waline") &&
			!e.includes("giscus") &&
			!e.includes("disqus") &&
			!e.includes("artalk") &&
			!e.includes("bilibili") &&
			!e.includes("myanimelist") &&
			!e.includes("vndb") &&
			!e.includes("bangumi"),
	);
	check(
		"线上无意外控制台错误",
		realErrors.length === 0,
		realErrors.slice(0, 5).join(" | "),
	);

	// 4. 移动端
	const mobile = await browser.newContext({
		viewport: { width: 390, height: 844 },
	});
	const mpage = await mobile.newPage();
	await mpage.goto(BASE + "/", { waitUntil: "load", timeout: 60000 });
	await mpage.waitForTimeout(2000);
	const hOverflow = await mpage.evaluate(
		() =>
			document.documentElement.scrollWidth >
			document.documentElement.clientWidth + 2,
	);
	check("线上移动端无横向溢出", !hOverflow);
	await mobile.close();
} finally {
	await browser.close();
}
summary();

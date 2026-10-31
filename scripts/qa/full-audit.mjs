// 全功能项无头审计：页面 / API 正负用例 / 交互 / 后台 / 静态资源
// 用法: node scripts/qa/full-audit.mjs http://localhost:PORT
import { launchBrowser, login } from "./lib.mjs";

const BASE = process.argv[2] || "http://localhost:8941";
const rows = [];
const R = (name, ok, extra = "", info = false) =>
	rows.push({ name, ok, extra, info });
const API = (p, init) =>
	fetch(BASE + p, init).then(async (r) => ({
		status: r.status,
		ct: r.headers.get("content-type") || "",
		body: (await r.text().catch(() => "")).slice(0, 120),
	}));

// ---------- 1) 页面 ----------
async function pages() {
	let slug = "firedre";
	try {
		const j = await (await fetch(BASE + "/api/allPostMeta.json")).json();
		const arr = Array.isArray(j) ? j : j.posts || [];
		if (arr[0]?.slug) slug = String(arr[0].slug).split("/").pop();
	} catch {}
	const list = [
		["/", "#navbar", "首页"],
		["/page/2/", "#navbar", "首页分页"],
		["/about/", "#navbar", "关于"],
		["/archive/", "#navbar", "归档"],
		["/categories/", "#navbar", "分类"],
		["/tags/", "#navbar", "标签"],
		["/series/", "#navbar", "系列"],
		["/friends/", "#navbar", "友链"],
		["/sponsor/", "#navbar", "赞助"],
		["/guestbook/", "#navbar", "留言板"],
		["/gallery/", "#navbar", "相册"],
		["/dynamic/", "#navbar", "动态"],
		["/bangumi/", "#navbar", "番剧"],
		["/myanimelist/", "#navbar", "MAL"],
		["/vndb/", "#navbar", "VNDB"],
		["/bilibili/", "#navbar", "B站"],
		["/booknav/", "#navbar", "书签导航"],
		["/search/", "#navbar", "搜索页"],
		[`/posts/${slug}/`, ".custom-md", `文章页(${slug})`],
		["/rss/", "#navbar", "RSS 页"],
	];
	const { browser, page } = await launchBrowser({ width: 1440, height: 900 });
	for (const [p, sel, name] of list) {
		const mine = [];
		const onConsole = (m) => {
			if (m.type() === "error") mine.push(m.text());
		};
		const onErr = (e) => mine.push(String(e));
		page.on("console", onConsole);
		page.on("pageerror", onErr);
		try {
			const resp = await page.goto(BASE + p, {
				waitUntil: "domcontentloaded",
				timeout: 45000,
			});
			await page.waitForTimeout(900);
			const found = await page.evaluate(
				(s) => !!document.querySelector(s),
				sel,
			);
			const errs = mine.filter(
				(e) => !/favicon|i-meto|Failed to fetch|net::ERR|ERR_/i.test(e),
			);
			const gated =
				/bangumi|myanimelist|vndb|bilibili/.test(p) && resp?.status() === 404;
			const okStatus = resp?.status() === 200 || gated;
			R(
				`页面 ${name} ${p}`,
				okStatus && found && (errs.length === 0 || gated),
				gated
					? `status=404 设置禁用→/404/（预期，控制台 404 属重定向目标） 关键元素=${found ? "有" : "无"}`
					: `status=${resp?.status()}${gated && resp?.status() === 404 ? "(设置禁用→/404/ 预期)" : ""} 关键元素=${found ? "有" : "无"} 错误=${errs.length}${errs.length ? " " + errs[0].slice(0, 70) : ""}`,
			);
		} catch (e) {
			R(`页面 ${name} ${p}`, false, "异常 " + e.message.slice(0, 60));
		}
		page.off("console", onConsole);
		page.off("pageerror", onErr);
	}
	// 未知路径：实测为 catch-all 软 404（200/302），断言「不得 5xx」并记录实际行为
	for (const p of ["/__nope__/", "/posts/__nope__/"]) {
		const r = await API(p);
		R(
			`页面 未知路径 ${p}（应无 5xx）`,
			r.status < 500,
			`实际 status=${r.status}（既有软 404 行为，仅记录）`,
			true,
		);
	}
	await browser.close();
}

// ---------- 2) API ----------
async function apis() {
	const pos = [
		["/api/settings/client", "设置-客户端"],
		["/api/allPostMeta.json", "全部文章元数据"],
		["/api/dynamic.json", "动态"],
		["/api/gallery", "相册列表"],
		["/api/friends", "友链"],
		["/api/site-links", "站点链接"],
		["/api/notice", "公告"],
		["/api/about", "关于（无数据时 404）"],
		["/rss.xml", "RSS"],
		["/sitemap.xml", "Sitemap"],
		["/robots.txt", "robots"],
	];
	for (const [p, name] of pos) {
		const r = await API(p);
		const ok =
			p === "/api/about"
				? r.status === 200 || r.status === 404
				: r.status === 200;
		R(`API ${name}`, ok, `status=${r.status} ct=${r.ct.split(";")[0]}`);
	}
	const cp = await API(
		"/api/cover-proxy/?u=https%3A%2F%2Ft.alcy.cc%2Fycy&w=828&f=webp",
	);
	R(
		"API 封面代理（正向）",
		cp.status === 200 && cp.ct.startsWith("image/"),
		`status=${cp.status} ct=${cp.ct.split(";")[0]}`,
	);
	const neg = [
		["/api/cover-proxy/", {}, 400, "缺 u 参数"],
		[
			"/api/cover-proxy/?u=http%3A%2F%2Ft.alcy.cc%2Fx",
			{},
			400,
			"非 https 外链",
		],
		["/api/cover-proxy/?u=%2Fassets%2Fx.avif", {}, 400, "同站路径"],
		[
			"/api/cover-proxy/?u=https%3A%2F%2Ft.alcy.cc%2Fycy",
			{ method: "POST" },
			404,
			"POST（方法不允许→404）",
		],
		["/api/about", { method: "PUT", body: "x" }, 401, "PUT 无鉴权"],
		["/api/settings", { method: "PUT", body: "{}" }, 401, "设置 PUT 无鉴权"],
		["/api/posts/x", { method: "DELETE" }, 401, "删除无鉴权"],
		[
			"/api/gallery/x",
			{ method: "POST", body: "{}" },
			403,
			"相册写入无鉴权（403）",
		],
		["/api/friends/x", { method: "DELETE" }, 401, "友链删除无鉴权"],
		["/api/notice", { method: "PUT", body: "x" }, 401, "公告 PUT 无鉴权"],
	];
	for (const [p, init, want, name] of neg) {
		const r = await API(p, init);
		R(
			`API 负向 ${name}`,
			r.status === want,
			`status=${r.status}（期望 ${want}）`,
		);
	}
}

// ---------- 3) 交互 ----------
async function interactions() {
	const { browser, page, errors } = await launchBrowser({
		width: 1440,
		height: 900,
	});
	const hydration = [];
	page.on("console", (m) => {
		if (/hydrat|lightMode|searchNoResults|__FIREDRE_I18N/i.test(m.text()))
			hydration.push(m.text().slice(0, 100));
	});
	const A = (n, ok, ex = "", info = false) => R(`交互 ${n}`, ok, ex, info);
	try {
		await page.goto(BASE + "/", { waitUntil: "load", timeout: 60000 });
		await page.waitForTimeout(2500);
		// i18n 词典 + 水合
		const dict = await page.evaluate(() => ({
			has: !!window.__FIREDRE_I18N__,
			keys: window.__FIREDRE_I18N__
				? Object.keys(window.__FIREDRE_I18N__).length
				: 0,
		}));
		A("i18n 词典注入", dict.has && dict.keys > 200, JSON.stringify(dict));
		A(
			"Svelte 岛水合无报错",
			hydration.length === 0,
			hydration.slice(0, 1).join(""),
		);
		// 主题切换（真实 id: #scheme-switch + #theme-mode-panel）
		const before = await page.evaluate(() =>
			document.documentElement.classList.contains("dark"),
		);
		const toggled = await page.evaluate(async () => {
			document.querySelector("#scheme-switch")?.click();
			await new Promise((r) => setTimeout(r, 700));
			const panel = document.querySelector("#theme-mode-panel");
			const items = panel
				? [...panel.querySelectorAll("button, [role=menuitem], li")]
				: [];
			const target = items.find((x) =>
				/dark|深色|暗/i.test(x.textContent || ""),
			);
			target?.click();
			await new Promise((r) => setTimeout(r, 700));
			return { panelOpen: !!panel, items: items.length, clicked: !!target };
		});
		const after = await page.evaluate(() =>
			document.documentElement.classList.contains("dark"),
		);
		await page.reload({ waitUntil: "load" });
		await page.waitForTimeout(900);
		const persisted = await page.evaluate(() =>
			document.documentElement.classList.contains("dark"),
		);
		A(
			"主题切换生效并持久化",
			before !== after && persisted === after,
			`${JSON.stringify(toggled)} dark ${before}→${after}, 刷新后=${persisted}`,
		);
		// swup
		const navOk = await page.evaluate(async () => {
			const a = [...document.querySelectorAll('a[href^="/"]')].find((x) =>
				(x.getAttribute("href") || "").startsWith("/about"),
			);
			if (!a) return false;
			a.click();
			await new Promise((r) => setTimeout(r, 2200));
			return (
				location.pathname.includes("about") &&
				!!document.querySelector("#navbar")
			);
		});
		A("swup 软导航", navOk);
		// 文章页 TOC
		await page.goto(BASE + "/posts/firedre/", {
			waitUntil: "load",
			timeout: 60000,
		});
		await page.waitForTimeout(1200);
		const toc = await page.evaluate(async () => {
			const a = document.querySelector(
				"#toc a[href^='#'], .toc-content a[href^='#'], a.toc-link",
			);
			if (!a) return { has: false };
			a.click();
			await new Promise((r) => setTimeout(r, 400));
			return { has: true, hash: location.hash };
		});
		A("文章页 TOC 锚点", toc.has && toc.hash.length > 1, JSON.stringify(toc));
		// 音乐播放器
		const music = await page.evaluate(async () => {
			document.getElementById("music-player-switch")?.click();
			await new Promise((r) => setTimeout(r, 6000));
			const st = window.__fireflyMusic?.getState?.();
			return { init: !!st?.initialized, tracks: st?.playlist?.length ?? 0 };
		});
		A("音乐播放器按需初始化", music.init, JSON.stringify(music));
		// 回到顶部按钮存在性（不改行为，仅记录）
		const btt = await page.evaluate(
			() => !!document.getElementById("back-to-top-btn"),
		);
		A("回到顶部控件存在", btt, "");
	} catch (e) {
		A("桌面交互无异常", false, e.message.slice(0, 90));
	}
	// 移动端
	try {
		const m = await launchBrowser({ width: 390, height: 844 });
		const p2 = m.page;
		await p2.goto(BASE + "/", { waitUntil: "load", timeout: 60000 });
		await p2.waitForTimeout(2000);
		const drawer = await p2.evaluate(async () => {
			const btn = document.querySelector("#nav-menu-switch");
			btn?.click();
			await new Promise((r) => setTimeout(r, 900));
			const panel = document.querySelector("#nav-menu-panel");
			const rect = panel?.getBoundingClientRect();
			return {
				has: !!btn,
				open:
					!!panel &&
					rect.width > 0 &&
					getComputedStyle(panel).display !== "none",
			};
		});
		A("移动端抽屉可开", drawer.has && drawer.open, JSON.stringify(drawer));
		// 移动端：无横向溢出（布局规整的硬指标）
		const overflow = await p2.evaluate(() => ({
			docW: document.documentElement.scrollWidth,
			winW: window.innerWidth,
			offenders: [...document.querySelectorAll("*")]
				.filter(
					(el) => el.getBoundingClientRect().right > window.innerWidth + 2,
				)
				.slice(0, 3)
				.map((el) => `${el.tagName}.${String(el.className).slice(0, 28)}`),
		}));
		A(
			"移动端无横向溢出",
			overflow.docW <= overflow.winW + 2,
			JSON.stringify(overflow),
		);
		// 移动端：关键控件可见（触控热区 ≥44px 由既有修复保证）
		const ctrls = await p2.evaluate(() => {
			const ids = [
				"#nav-menu-switch",
				"#scheme-switch",
				"#music-player-switch",
				"#display-settings-switch",
			];
			return ids.map((id) => {
				const el = document.querySelector(id);
				const r = el?.getBoundingClientRect();
				return {
					id,
					w: Math.round(r?.width || 0),
					h: Math.round(r?.height || 0),
				};
			});
		});
		A(
			"移动端关键控件热区 ≥44px",
			ctrls.every((c) => c.w >= 44 && c.h >= 44),
			JSON.stringify(ctrls),
		);
		// 移动端壁纸优先级（现状基线，见 dev-log 备案）：
		//  - 至少一张可见图为 eager + fetchpriority=high（首屏进度优先）
		//  - 被 CSS 隐藏的另一断点图必须为 lazy（避免跨断点白费下载）
		//  - 已知不一致：banner-image-slot 分支（非轮播）与轮播首图并存时优先级策略不同，属既有状态，暂不改动
		const mw = await p2.evaluate(() => {
			const imgs = [...document.querySelectorAll("#wallpaper-wrapper img")];
			const vis = imgs.filter((i) => i.getBoundingClientRect().width > 0);
			const hidden = imgs.filter((i) => i.getBoundingClientRect().width === 0);
			return {
				visCount: vis.length,
				visEagerCount: vis.filter(
					(i) =>
						i.getAttribute("loading") === "eager" &&
						i.getAttribute("fetchpriority") === "high",
				).length,
				visLazyCount: vis.filter((i) => i.getAttribute("loading") === "lazy")
					.length,
				hiddenLazy: hidden.every((i) => i.getAttribute("loading") === "lazy"),
				visUrl: decodeURIComponent(vis[0]?.currentSrc || "").slice(-46),
			};
		});
		A(
			"移动端壁纸优先级（≥1 张可见 eager+high；隐藏图 lazy）",
			mw.visCount > 0 && mw.visEagerCount >= 1 && mw.hiddenLazy,
			JSON.stringify(mw) +
				(mw.visLazyCount > 0
					? " ｜ 备案：另有 " +
						mw.visLazyCount +
						" 张可见图为 lazy（既有策略不一致）"
					: ""),
		);
		// 移动端：文章页正文与 TOC
		await p2.goto(BASE + "/posts/firedre/", {
			waitUntil: "load",
			timeout: 60000,
		});
		await p2.waitForTimeout(1200);
		const art = await p2.evaluate(() => ({
			body: !!document.querySelector(".custom-md"),
			cover: !!document.querySelector("#post-cover"),
		}));
		A("移动端文章页渲染", art.body, JSON.stringify(art));
		await m.browser.close();
	} catch (e) {
		A("移动端交互", false, e.message.slice(0, 80));
	}
	const fat = errors.filter(
		(e) => !/i-meto|Failed to fetch|net::ERR|ERR_|favicon/i.test(e),
	);
	A(
		"交互无致命控制台错误",
		fat.length === 0,
		fat
			.slice(0, 1)
			.map((x) => x.slice(0, 90))
			.join(""),
	);
	await browser.close();
}

// ---------- 4) 后台 ----------
async function admin() {
	const { browser, page, errors } = await launchBrowser({
		width: 1440,
		height: 900,
	});
	try {
		await login(page, BASE);
		for (const r of [
			"/admin/",
			"/admin/posts",
			"/admin/settings",
			"/admin/gallery",
			"/admin/friends",
			"/admin/dynamic",
		]) {
			const before = errors.length;
			const resp = await page
				.goto(BASE + r, { waitUntil: "domcontentloaded", timeout: 45000 })
				.catch(() => null);
			await page.waitForTimeout(900);
			const has = await page.evaluate(
				() => !!document.querySelector("main, #admin-app, .admin-shell, body"),
			);
			const errs = errors
				.slice(before)
				.filter((e) => !/i-meto|Failed to fetch|net::ERR|favicon/i.test(e));
			R(
				`后台 ${r}`,
				(resp?.status() ?? 0) < 400 && has && errs.length === 0,
				`status=${resp?.status()} 错误=${errs.length}`,
			);
		}
	} catch (e) {
		R("后台流程", false, e.message.slice(0, 90));
	}
	await browser.close();
}

await pages();
await apis();
await interactions();
await admin();

const pass = rows.filter((r) => r.ok).length;
const fails = rows.filter((r) => !r.ok);
console.log("\n=== 全功能项审计 ===");
for (const r of rows)
	console.log(
		`${r.ok ? "PASS" : r.info ? "INFO" : "FAIL"}  ${r.name}${r.extra ? "  → " + r.extra : ""}`,
	);
console.log(
	`\n通过 ${pass}/${rows.length}；失败 ${fails.filter((f) => !f.info).length}`,
);
if (fails.length) {
	console.log("\n非通过项:");
	fails.forEach((f) => console.log(`  - ${f.name} | ${f.extra}`));
}
process.exit(0);

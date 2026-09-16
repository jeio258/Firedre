import { chromium } from "playwright";
import { startPreview, stopPreview, check, summary, d1, readSettingGroup } from "./lib.mjs";

// P0/P1 改动 headless 实测：twikoo 懒加载 / 封面代理 / preload 优先级 / 首卡 150ms / HTML 缓存命中

// 本地默认评论关闭（type=none），注入 twikoo 配置以验证懒加载；测完还原
const origComment = readSettingGroup("comment");
const commentJson = JSON.stringify({
	type: "twikoo",
	enabled: true,
	twikooEnvId: "https://twikoo.vercel.app",
	twikooJsUrl: "https://cdn.jsdelivr.net/npm/twikoo@1.7.14/dist/twikoo.min.js",
});
d1(`INSERT OR REPLACE INTO site_settings(key,value) VALUES('comment','${commentJson.replace(/'/g, "''")}')`);
const restoreComment = () => {
	if (origComment === null) {
		d1(`DELETE FROM site_settings WHERE key='comment'`);
	} else {
		d1(`UPDATE site_settings SET value='${origComment.replace(/'/g, "''")}' WHERE key='comment'`);
	}
};

const { proc, base } = await startPreview();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

try {
	// ===== 1. 首页静态断言 =====
	const resp = await page.goto(base + "/", { waitUntil: "domcontentloaded" });
	const html = await resp.text();
	check("P0-2 首页 wallpaper/avatar preload 不含 fetchpriority=high",
		!/<link rel="preload" as="image" [^>]*fetchpriority="high"/.test(html));
	check("P1-2 首卡封面淡入 duration-150", html.includes("duration-150"));
	check("P1-2 其余卡片保留 duration-500", html.includes("duration-500"));

	// ===== 2. 首页封面走代理 =====
	const proxiedImgs = await page.evaluate(() =>
		[...document.querySelectorAll("img[data-cover-img]")].map((i) => i.src),
	);
	check("P1-1 首页远程封面已改走 /api/cover-proxy",
		proxiedImgs.length > 0 && proxiedImgs.every((u) => u.includes("/api/cover-proxy")),
		JSON.stringify(proxiedImgs.slice(0, 1)));

	// ===== 3. HTML 缓存命中（P0-1 前提机制未破坏） =====
	const h1 = await page.evaluate(async () => {
		const r = await fetch(location.href, { cache: "no-store" });
		return r.headers.get("x-firedre-cache");
	});
	check("P0-1 HTML 缓存仍命中（X-Firedre-Cache: CACHE-HIT）", h1 === "CACHE-HIT", String(h1));

	// ===== 4. 文章页 twikoo 懒加载 =====
	await page.goto(base + "/posts/firedre/", { waitUntil: "domcontentloaded" });
	await page.waitForTimeout(1200);
	const hasTcomment = await page.evaluate(() => !!document.getElementById("tcomment"));
	check("P0-3 评论容器已渲染（twikoo 注入生效）", hasTcomment);
	const twikooBefore = await page.evaluate(() =>
		[...document.querySelectorAll("script[src]")].filter((s) => s.src.includes("twikoo")).length);
	check("P0-3 文章页初始不加载 twikoo 脚本", twikooBefore === 0, `count=${twikooBefore}`);

	await page.evaluate(() => document.querySelector("#tcomment")?.scrollIntoView({ block: "center" }));
	await page.waitForTimeout(2500);
	const twikooAfter = await page.evaluate(() =>
		[...document.querySelectorAll("script[src]")].filter((s) => s.src.includes("twikoo")).length);
	check("P0-3 滚动到评论区后 twikoo 脚本被拉起", twikooAfter > 0, `count=${twikooAfter}`);

	// ===== 5. swup 软导航进入文章页后懒加载仍工作 =====
	await page.goto(base + "/", { waitUntil: "domcontentloaded" });
	await page.waitForTimeout(800);
	await page.evaluate(() => {
		const a = document.querySelector('a[href*="/posts/"]');
		if (a) a.click();
	});
	await page.waitForURL("**/posts/**", { timeout: 10000 });
	await page.waitForTimeout(1000);
	const softBefore = await page.evaluate(() =>
		[...document.querySelectorAll("script[src]")].filter((s) => s.src.includes("twikoo")).length);
	check("P0-3 软导航进入文章页初始不加载 twikoo", softBefore === 0, `count=${softBefore}`);
	await page.evaluate(() => document.querySelector("#tcomment")?.scrollIntoView({ block: "center" }));
	await page.waitForTimeout(2500);
	const softAfter = await page.evaluate(() =>
		[...document.querySelectorAll("script[src]")].filter((s) => s.src.includes("twikoo")).length);
	check("P0-3 软导航滚动后 twikoo 脚本被拉起", softAfter > 0, `count=${softAfter}`);

	await browser.close();

	// ===== 6. 封面代理 HTTP 语义（正/负向，带尾斜杠避免 301） =====
	const px = (u) => `${base}/api/cover-proxy/?u=${encodeURIComponent(u)}&w=828`;
	const pr = await fetch(px("https://t.alcy.cc/ycy"));
	const ct = pr.headers.get("content-type") || "";
	check("P1-1 代理返回 200 且为图片", pr.status === 200 && ct.startsWith("image/"),
		`status=${pr.status} ct=${ct}`);
	const buf = await pr.arrayBuffer();
	check("P1-1 代理返回非空图片字节", buf.byteLength > 1000, `${buf.byteLength}B`);

	const neg1 = await fetch(px("http://evil.com/x.png"));
	check("负向 http 外链被拒 400", neg1.status === 400, `status=${neg1.status}`);
	const neg2 = await fetch(px(`https://${new URL(base).hostname}/self`));
	check("负向 同主机被拒 400", neg2.status === 400, `status=${neg2.status}`);
	const neg3 = await fetch(`${base}/api/cover-proxy/`);
	check("负向 缺参 400", neg3.status === 400, `status=${neg3.status}`);
	const neg4 = await fetch(px("https://nonexistent.invalid/x.png"), { redirect: "manual" });
	check("负向 拉取失败 302 回退原图", neg4.status === 302 &&
		neg4.headers.get("location") === "https://nonexistent.invalid/x.png",
		`status=${neg4.status} loc=${neg4.headers.get("location")}`);
	const pr2 = await fetch(px("https://t.alcy.cc/ycy"));
	check("P1-1 二次请求代理仍 200（缓存链路）", pr2.status === 200 && (pr2.headers.get("content-type") || "").startsWith("image/"),
		`status=${pr2.status} ct=${pr2.headers.get("content-type")}`);
} finally {
	await browser.close().catch(() => {});
	stopPreview(proc);
	restoreComment();
}
summary();

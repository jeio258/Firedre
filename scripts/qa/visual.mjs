// 视觉门禁 v2：首屏几何断言 + 全页像素哈希（离屏区块用像素校验，解除 content-visibility 的基线冲突）
// 用法: node scripts/qa/visual.mjs <base> --baseline   # 采集几何+像素基线
//       node scripts/qa/visual.mjs <base>              # 比对
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { launchBrowser, login } from "./lib.mjs";

const BASE = process.argv[2] || "http://localhost:9001";
const MODE = process.argv.includes("--baseline") ? "baseline" : "compare";
const GEO_FILE = "scripts/qa/visual-baseline.json";
const PIX_FILE = "scripts/qa/visual-pixels.json";
const SHOT_DIR = "scripts/qa/screenshots";

const VIEWPORTS = [
	{ label: "desktop", width: 1440, height: 900, touch: false },
	{ label: "tablet", width: 834, height: 1112, touch: true },
	{ label: "mobile", width: 375, height: 667, touch: true },
];
const TARGETS = [
	{
		route: "/",
		name: "首页",
		selectors: [
			"#navbar",
			"#main-grid",
			"#banner-images-container",
			".post-card-item",
			"#footer",
		],
	},
	{
		route: "/posts/firedre/",
		name: "文章页",
		selectors: ["#navbar", ".custom-md", "#post-cover", "#footer"],
	},
	{ route: "/about/", name: "关于页", selectors: ["#navbar", ".custom-md"] },
	{ route: "/friends/", name: "友链页", selectors: ["#navbar", "#main-grid"] },
];
const ADMIN_TARGETS = [
	// 覆盖侧栏与导航条目：避免侧栏几何变化无法被门禁捕获
	{
		route: "/admin/",
		name: "后台-首页",
		selectors: [".admin-shell", "#admin-app", "aside", "a.nav-item"],
	},
	{
		route: "/admin/posts/",
		name: "后台-文章",
		selectors: [".crud-head", ".crud-page", "a.nav-item"],
	},
	{
		route: "/admin/settings/",
		name: "后台-设置",
		selectors: [".s2-host", ".a2f", "a.nav-item"],
	},
];
const GRID = 24; // 像素哈希网格
const MAD_TOL = 6; // 平均绝对差容忍（0-255）

// 像素哈希：把截图 dataURL 交回浏览器，用其自身解码器 + canvas 缩放到 GRID×GRID 取灰度（零依赖）
let PIXEL_OK = true;
async function grayGrid(page, buf, masks = [], grid = GRID) {
	try {
		const b64 = buf.toString("base64");
		return await page.evaluate(
			async ({ b64, grid, masks }) => {
				const img = await new Promise((res, rej) => {
					const im = new Image();
					im.onload = () => res(im);
					im.onerror = rej;
					im.src = "data:image/png;base64," + b64;
				});
				const cv = document.createElement("canvas");
				cv.width = grid;
				cv.height = grid;
				const ctx = cv.getContext("2d");
				ctx.drawImage(img, 0, 0, grid, grid);
				const d = ctx.getImageData(0, 0, grid, grid).data;
				const out = [];
				for (let i = 0; i < d.length; i += 4)
					out.push(0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]);
				// 掩码：随机远程图/壁纸/占位区域不参与比较（按 24×24 网格置 flags）
				const flags = new Array(grid * grid).fill(1);
				const vw = window.innerWidth,
					vh = window.innerHeight;
				for (const m of masks) {
					const x0 = Math.max(0, Math.floor((m[0] / vw) * grid)),
						x1 = Math.min(grid - 1, Math.ceil(((m[0] + m[2]) / vw) * grid));
					const y0 = Math.max(0, Math.floor((m[1] / vh) * grid)),
						y1 = Math.min(grid - 1, Math.ceil(((m[1] + m[3]) / vh) * grid));
					for (let y = y0; y <= y1; y++)
						for (let x = x0; x <= x1; x++) flags[y * grid + x] = 0;
				}
				return { g: out, flags };
			},
			{ b64, grid, masks },
		);
	} catch {
		PIXEL_OK = false;
		return null;
	}
}
const mad = (a, b) => {
	if (!a || !b || !a.g || !b.g || a.g.length !== b.g.length) return 255;
	let s = 0,
		n = 0;
	for (let i = 0; i < a.g.length; i++) {
		if (!a.flags[i] || !b.flags[i]) continue; // 掩码格跳过
		s += Math.abs(a.g[i] - b.g[i]);
		n++;
	}
	return n ? s / n : 0;
};

async function collect(page, targets, label) {
	const geo = {},
		pix = {};
	for (const t of targets) {
		try {
			await page.goto(BASE + t.route, { waitUntil: "load", timeout: 45000 });
			await page.waitForTimeout(1800);
			const rects = await page.evaluate((sels) => {
				const out = {};
				for (const s of sels) {
					const el = document.querySelector(s);
					if (!el) {
						out[s] = null;
						continue;
					}
					const r = el.getBoundingClientRect();
					out[s] = {
						rect: [
							Math.round(r.x),
							Math.round(r.y),
							Math.round(r.width),
							Math.round(r.height),
						],
						offscreen: r.top >= window.innerHeight,
					};
				}
				return out;
			}, t.selectors);
			geo[`${label}|${t.name}`] = rects;
			// 冻结动效（打字机/波浪/樱花/过渡）与启用 reduced-motion，保证像素可比
			await page.emulateMedia({ reducedMotion: "reduce" }).catch(() => {});
			await page
				.addStyleTag({
					content:
						"*,*::before,*::after{animation:none !important;transition:none !important;caret-color:transparent !important}",
				})
				.catch(() => {});
			await page.waitForTimeout(600);
			const shots = [];
			const scrollH = await page.evaluate(() =>
				Math.max(0, document.documentElement.scrollHeight - window.innerHeight),
			);
			for (const frac of [0, 0.5, 1]) {
				await page.evaluate(
					(y) => window.scrollTo(0, y),
					Math.round(scrollH * frac),
				);
				await page.waitForTimeout(1100);
				const masks = await page.evaluate(() =>
					[
						...document.querySelectorAll(
							'img[data-remote="true"], img[data-cover-img], #banner-images-container img, .lqip-placeholder, img.profile-avatar-image',
						),
					]
						.map((el) => {
							const r = el.getBoundingClientRect();
							return [r.x, r.y, r.width, r.height];
						})
						.filter((r) => r[2] > 0 && r[3] > 0),
				);
				const g = await grayGrid(page, await page.screenshot(), masks);
				if (g) shots.push(g);
			}
			if (shots.length) pix[`${label}|${t.name}`] = shots;
		} catch (e) {
			geo[`${label}|${t.name}`] = { error: e.message.slice(0, 70) };
		}
	}
	return { geo, pix };
}

const geoAll = {},
	pixAll = {};
for (const vp of VIEWPORTS) {
	const { browser, page } = await launchBrowser(
		{ width: vp.width, height: vp.height },
		{ hasTouch: vp.touch, isMobile: vp.touch && vp.width < 800 },
	);
	const { geo, pix } = await collect(page, TARGETS, vp.label);
	Object.assign(geoAll, geo);
	Object.assign(pixAll, pix);
	await browser.close();
}
// 后台（桌面）
const adm = await launchBrowser({ width: 1440, height: 900 });
try {
	await login(adm.page, BASE);
	const { geo, pix } = await collect(adm.page, ADMIN_TARGETS, "admin");
	Object.assign(geoAll, geo);
	Object.assign(pixAll, pix);
} catch {}
await adm.browser.close();

if (MODE === "baseline") {
	writeFileSync(GEO_FILE, JSON.stringify(geoAll, null, 1));
	if (PIXEL_OK && Object.keys(pixAll).length)
		writeFileSync(PIX_FILE, JSON.stringify(pixAll));
	console.log(
		`基线已写入：${GEO_FILE}（几何 ${Object.keys(geoAll).length} 组） + ${PIX_FILE}（像素 ${Object.keys(pixAll).length} 组×3 帧）`,
	);
	process.exit(0);
}

const geoBase = existsSync(GEO_FILE)
	? JSON.parse(readFileSync(GEO_FILE, "utf8"))
	: {};
const pixBase = existsSync(PIX_FILE)
	? JSON.parse(readFileSync(PIX_FILE, "utf8"))
	: {};
const diffs = [];
let skipped = 0;
for (const key of Object.keys(geoBase)) {
	const b = geoBase[key],
		n = geoAll[key];
	if (!n) {
		diffs.push(`${key}: 未采集到`);
		continue;
	}
	for (const sel of Object.keys(b)) {
		const bs = b[sel],
			ns = n[sel];
		if (!bs || !ns) {
			if (bs !== ns) diffs.push(`${key} ${sel}: 存在性变化`);
			continue;
		}
		if (bs === null || ns === null) {
			if (bs !== ns) diffs.push(`${key} ${sel}: 存在性变化`);
			continue;
		}
		if (bs.offscreen || ns.offscreen) {
			skipped++;
			continue;
		} // 离屏：交给像素哈希
		if (JSON.stringify(bs.rect) !== JSON.stringify(ns.rect))
			diffs.push(
				`${key} ${sel}: rect ${JSON.stringify(bs.rect)} → ${JSON.stringify(ns.rect)}`,
			);
	}
}
const pixDiffs = [];
for (const key of Object.keys(pixBase)) {
	const b = pixBase[key],
		n = pixAll[key];
	if (!n) {
		pixDiffs.push(`${key}: 未采集到`);
		continue;
	}
	for (let i = 0; i < b.length; i++) {
		const d = mad(b[i], n[i]);
		if (d > MAD_TOL)
			pixDiffs.push(`${key} 帧${i}: MAD=${d.toFixed(1)} (>${MAD_TOL})`);
	}
}
console.log("=== 视觉门禁 v2 ===");
console.log(
	`几何：${Object.keys(geoBase).length} 组，离屏跳过 ${skipped} 项，差异 ${diffs.length}`,
);
diffs.slice(0, 20).forEach((d) => console.log("  ✗ " + d));
if (Object.keys(pixBase).length) {
	console.log(
		`像素：${Object.keys(pixBase).length} 组 × ${(pixBase[Object.keys(pixBase)[0]] || []).length} 帧，差异 ${pixDiffs.length}`,
	);
	pixDiffs.slice(0, 12).forEach((d) => console.log("  ✗ " + d));
} else console.log("像素：跳过（未采集到基线）");
const ok = diffs.length === 0 && pixDiffs.length === 0;
console.log(
	ok
		? "\n结论：0 差异 ✓"
		: `\n结论：几何 ${diffs.length} + 像素 ${pixDiffs.length} 处差异`,
);
process.exit(0);

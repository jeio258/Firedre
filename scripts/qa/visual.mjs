// 视觉/布局基线：采集关键元素的几何与关键计算样式，与基线 JSON 比对。
// 用法：
//   pnpm qa:visual          对比基线（有差异则退出码 1）
//   pnpm qa:visual --update 重新写入基线（确认变更后使用）
// 说明：基线针对本地开发数据采集；用途是"改动前后不变量"的机器校验，
//       而非像素级像素比对（避免抗锯齿/字体渲染噪声）。
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import {
	startPreview,
	stopPreview,
	launchBrowser,
	login,
	injectTestAdmin,
	check,
	summary,
} from "./lib.mjs";

const UPDATE = process.argv.includes("--update");
const BASELINE = "scripts/qa/visual-baseline.json";
const SHOT_DIR = "scripts/qa/screenshots";

const TARGETS = [
	{ route: "/", name: "首页", selectors: ["#navbar", "#main-grid", "#banner-images-container", ".post-card-item", "#footer"] },
	{ route: "/posts/firedre/", name: "文章页", selectors: ["#navbar", ".custom-md", "#post-cover", "#footer"] },
	{ route: "/about/", name: "关于页", selectors: ["#navbar", ".custom-md"] },
	{ route: "/friends/", name: "友链页", selectors: ["#navbar", "#main-grid"] },
];

const ADMIN_TARGETS = [
	{ route: "/admin/links/", name: "后台-友链", selectors: [".crud-head", ".crud-page", ".btn-primary"] },
	{ route: "/admin/settings/", name: "后台-设置", selectors: [".s2-host", ".a2f", ".sn"] },
	{ route: "/admin/notice/", name: "后台-公告", selectors: [".notice-form", ".notice-form input", ".notice-form textarea"] },
	{ route: "/admin/dynamics/", name: "后台-动态", selectors: [".crud-head", ".crud-page"] },
];

const VIEWPORTS = [
	{ label: "desktop", width: 1440, height: 900, touch: false },
	{ label: "tablet", width: 834, height: 1112, touch: true },
	{ label: "mobile", width: 375, height: 667, touch: true },
];

const STYLE_KEYS = [
	"display", "visibility", "position", "fontSize", "fontWeight",
	"padding", "margin", "borderRadius", "borderTopWidth", "backgroundColor", "color",
];

async function collect(page, targets, label, viewport) {
	const snap = {};
	for (const t of targets) {
		await page.goto(base + t.route, { waitUntil: "load", timeout: 45000 }).catch(() => {});
		await page.waitForTimeout(2200);
		snap[`${label}|${t.name}`] = await page.evaluate(
			({ selectors, keys }) => {
				const out = {};
				for (const sel of selectors) {
					const el = document.querySelector(sel);
					if (!el) {
						out[sel] = { missing: true };
						continue;
					}
					const r = el.getBoundingClientRect();
					const cs = getComputedStyle(el);
					const styles = {};
					for (const k of keys) styles[k] = cs[k];
					out[sel] = {
						rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
						styles,
					};
				}
				return out;
			},
			{ selectors: t.selectors, keys: STYLE_KEYS },
		);
		if (!existsSync(SHOT_DIR)) mkdirSync(SHOT_DIR, { recursive: true });
		await page.screenshot({ path: `${SHOT_DIR}/${label}-${t.name}.png` }).catch(() => {});
	}
	return snap;
}

function diffSnapshots(baseSnap, nowSnap) {
	const diffs = [];
	for (const pageKey of Object.keys(nowSnap)) {
		const nowTargets = nowSnap[pageKey];
		const baseTargets = baseSnap[pageKey];
		if (!baseTargets) {
			diffs.push(`${pageKey}: 基线缺失（新增目标）`);
			continue;
		}
		for (const sel of Object.keys(nowTargets)) {
			const n = nowTargets[sel];
			const b = baseTargets[sel];
			if (!b) {
				diffs.push(`${pageKey} ${sel}: 基线缺失`);
				continue;
			}
			if (n.missing !== b.missing) {
				diffs.push(`${pageKey} ${sel}: 存在性变化（基线${b.missing ? "缺失" : "存在"} → 现在${n.missing ? "缺失" : "存在"}）`);
				continue;
			}
			if (n.missing) continue;
			if (JSON.stringify(n.rect) !== JSON.stringify(b.rect)) {
				diffs.push(`${pageKey} ${sel}: rect ${JSON.stringify(b.rect)} → ${JSON.stringify(n.rect)}`);
			}
			for (const k of Object.keys(n.styles)) {
				if (n.styles[k] !== b.styles[k]) {
					diffs.push(`${pageKey} ${sel}: ${k} "${b.styles[k]}" → "${n.styles[k]}"`);
				}
			}
		}
	}
	return diffs;
}

const server = await startPreview();
const base = server.base;
const restoreAdmin = injectTestAdmin();
let browser;
let snapshot = {};

try {
	// 前台各视口
	for (const vp of VIEWPORTS) {
		const b = await launchBrowser(
			{ width: vp.width, height: vp.height },
			{ hasTouch: vp.touch, isMobile: vp.touch && vp.width < 800 },
		);
		browser = b.browser;
		const part = await collect(b.page, TARGETS, vp.label, vp);
		Object.assign(snapshot, part);
		await b.browser.close();
	}
	// 后台（桌面）
	const ab = await launchBrowser({ width: 1440, height: 900 });
	browser = ab.browser;
	const authed = await login(ab.page, base);
	check("后台登录成功（视觉基线）", authed);
	if (authed) {
		const part = await collect(ab.page, ADMIN_TARGETS, "admin", {});
		Object.assign(snapshot, part);
	}
	await ab.browser.close();
	browser = null;

	if (UPDATE || !existsSync(BASELINE)) {
		writeFileSync(BASELINE, JSON.stringify(snapshot, null, 1));
		console.log(`已写入基线：${BASELINE}（${Object.keys(snapshot).length} 个页面目标）`);
		check("基线写入", true);
	} else {
		const baseSnap = JSON.parse(readFileSync(BASELINE, "utf8"));
		const diffs = diffSnapshots(baseSnap, snapshot);
		check("视觉/布局与基线一致", diffs.length === 0, `${diffs.length} 处差异`);
		if (diffs.length) {
			console.log("\n差异明细：");
			for (const d of diffs.slice(0, 40)) console.log("  - " + d);
		}
		console.log(`\n截图已更新至 ${SHOT_DIR}/ 供人工比对`);
	}
} finally {
	if (browser) await browser.close().catch(() => {});
	stopPreview(server.proc);
	if (restoreAdmin) restoreAdmin();
}

process.exit(summary() ? 0 : 1);

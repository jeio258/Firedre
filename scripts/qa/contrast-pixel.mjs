// 真实对比度取样门禁：一次整页截图 → 交回页面用 canvas 解码 → 逐元素裁剪区域做颜色直方图，
// 取众数色为背景、取与背景距离最远的一簇像素为字形色，计算 WCAG 比值。
// 与 site-audit 的「计算样式探针」互补：本脚本可判定壁纸/背景图上的文字（计算样式探针的盲区），
// 且不受 oklch/color-mix 序列化问题影响。
// 用法：node scripts/qa/contrast-pixel.mjs [baseUrl] [outJson]
import { writeFileSync } from "node:fs";
import { launchBrowser } from "./lib.mjs";

const BASE = process.argv[2] || "http://localhost:4321";
const OUT = process.argv[3] || "/tmp/contrast-pixel.json";
const VW = 1440;
const VH = 900;
// 明/暗两模式各跑一趟（暗色由 :root.dark 驱动，需在页面内注入 class）
const MODES = [
	{ name: "light", dark: false },
	{ name: "dark", dark: true },
];

const PAGES = [
	"/",
	"/page/2/",
	"/about/",
	"/archive/",
	"/categories/",
	"/tags/",
	"/series/",
	"/friends/",
	"/sponsor/",
	"/guestbook/",
	"/gallery/",
	"/dynamic/",
	"/booknav/",
	"/search/",
	"/rss/",
	"/posts/firedre/",
	"/404",
];

/**
 * 候选元素：只取「含直接文本节点」的元素（容器元素的 textContent 会拼接子孙文本，
 * 矩形会覆盖整块区域，众数背景无意义），并用 Range 取精确字形矩形；坐标为视口坐标。
 */
function collect() {
	const out = [];
	const els = document.querySelectorAll(
		"p, li, a, button, span, h1, h2, h3, code, td, label, div",
	);
	const range = document.createRange();
	const textRect = (el) => {
		let box = null;
		for (const n of el.childNodes) {
			if (n.nodeType !== 3) continue;
			if ((n.textContent || "").trim().length < 2) continue;
			range.selectNodeContents(n);
			const b = range.getBoundingClientRect();
			if (b.width <= 0 || b.height <= 0) continue;
			box = box
				? {
						left: Math.min(box.left, b.left),
						top: Math.min(box.top, b.top),
						right: Math.max(box.right, b.right),
						bottom: Math.max(box.bottom, b.bottom),
					}
				: { left: b.left, top: b.top, right: b.right, bottom: b.bottom };
		}
		return box;
	};
	for (const el of [...els].slice(0, 1200)) {
		const direct = [...el.childNodes]
			.filter((n) => n.nodeType === 3)
			.map((n) => n.textContent)
			.join("")
			.trim()
			.replace(/\s+/g, " ");
		if (direct.length < 4 || direct.length > 80) continue;
		if (el.closest("[inert]")) continue;
		if (el.checkVisibility && !el.checkVisibility()) continue;
		const cs = getComputedStyle(el);
		if (cs.textDecorationLine.includes("underline")) continue;
		if (cs.visibility === "hidden" || Number(cs.opacity) < 0.05) continue;
		const r = textRect(el);
		if (!r) continue;
		const w = r.right - r.left;
		const h = r.bottom - r.top;
		if (w < 8 || h < 6) continue;
		if (r.bottom < 4 || r.top > window.innerHeight - 4) continue;
		const size = Number.parseFloat(cs.fontSize) || 16;
		const bold = Number(cs.fontWeight) >= 700;
		out.push({
			text: direct.slice(0, 40),
			size: Math.round(size),
			need: size >= 24 || (size >= 18.66 && bold) ? 3 : 4.5,
			color: cs.color,
			x: Math.round(r.left),
			y: Math.round(r.top),
			w: Math.round(w),
			h: Math.round(h),
		});
	}
	return out;
}

/**
 * 逐元素取样：
 * - 背景 = 该区域像素的颜色众数（截图取样 → 可覆盖壁纸/背景图/渐变，静态探针的盲区）
 * - 前景 = 计算样式色（精确，经 1×1 canvas 像素回读解析 oklch/oklab/color-mix），
 *   半透明文字再按 alpha 合成到背景上
 * 注：不用「最远像素簇平均」估字形色——抗锯齿会把估计拉向背景、高估对比度。
 */
async function sample({ b64, cands, vw }) {
	const img = await new Promise((res, rej) => {
		const im = new Image();
		im.onload = () => res(im);
		im.onerror = rej;
		im.src = "data:image/png;base64," + b64;
	});
	const scale = img.width / vw;
	const cv = document.createElement("canvas");
	cv.width = img.width;
	cv.height = img.height;
	const ctx = cv.getContext("2d", { willReadFrequently: true });
	ctx.drawImage(img, 0, 0);
	// 颜色字符串 → sRGB：[r,g,b,a]（canvas 会原样回写 oklch 等，必须画像素再回读）
	const pc = document.createElement("canvas");
	pc.width = 1;
	pc.height = 1;
	const pctx = pc.getContext("2d", { willReadFrequently: true });
	const toRgb = (c) => {
		try {
			pctx.globalCompositeOperation = "copy";
			pctx.fillStyle = "#010203";
			pctx.fillStyle = c;
			if (String(pctx.fillStyle).toLowerCase() === "#010203") return null;
			pctx.fillRect(0, 0, 1, 1);
			const d = pctx.getImageData(0, 0, 1, 1).data;
			return [d[0], d[1], d[2], d[3] / 255];
		} catch {
			return null;
		}
	};
	const lum = (c) => {
		const [r, g, b] = c.map((v) => {
			v /= 255;
			return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
		});
		return 0.2126 * r + 0.7152 * g + 0.0722 * b;
	};
	const out = [];
	for (const c of cands) {
		const x = Math.max(0, Math.round(c.x * scale));
		const y = Math.max(0, Math.round(c.y * scale));
		const w = Math.min(img.width - x, Math.round(c.w * scale));
		const h = Math.min(img.height - y, Math.round(c.h * scale));
		if (w < 4 || h < 4) {
			out.push({ ...c, ratio: null, note: "区域过小/超出截图" });
			continue;
		}
		const d = ctx.getImageData(x, y, w, h).data;
		const px = [];
		const hist = new Map();
		for (let i = 0; i < d.length; i += 4) {
			const r = d[i];
			const g = d[i + 1];
			const b = d[i + 2];
			px.push([r, g, b]);
			const k = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
			hist.set(k, (hist.get(k) || 0) + 1);
		}
		let bk = 0;
		let bn = -1;
		for (const [k, n] of hist) {
			if (n > bn) {
				bn = n;
				bk = k;
			}
		}
		const bg = [
			(((bk >> 10) & 31) << 3) + 4,
			(((bk >> 5) & 31) << 3) + 4,
			((bk & 31) << 3) + 4,
		];
		const dist = new Array(px.length);
		let maxD = 0;
		for (let i = 0; i < px.length; i++) {
			const dd =
				Math.abs(px[i][0] - bg[0]) +
				Math.abs(px[i][1] - bg[1]) +
				Math.abs(px[i][2] - bg[2]);
			dist[i] = dd;
			if (dd > maxD) maxD = dd;
		}
		const fgRaw = toRgb(c.color);
		if (!fgRaw || fgRaw[3] <= 0.02) {
			out.push({
				...c,
				ratio: null,
				bg: bg.map(Math.round),
				note: "前景色透明/无法解析",
			});
			continue;
		}
		if (maxD < 40) {
			out.push({
				...c,
				ratio: null,
				bg: bg.map(Math.round),
				note: "区域内无字形对比像素（纯背景/未渲染文字）",
			});
			continue;
		}
		const a = fgRaw[3];
		const fg = [
			fgRaw[0] * a + bg[0] * (1 - a),
			fgRaw[1] * a + bg[1] * (1 - a),
			fgRaw[2] * a + bg[2] * (1 - a),
		];
		const L1 = lum(fg);
		const L2 = lum(bg);
		const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
		out.push({
			...c,
			ratio: Number(ratio.toFixed(2)),
			bg: bg.map(Math.round),
			fg: fg.map(Math.round),
		});
	}
	return out;
}

const { browser, page } = await launchBrowser({ width: VW, height: VH });
const report = [];
for (const mode of MODES) {
	// 明/暗偏好走站点自身持久化键（localStorage.theme = light|dark）：手动加 .dark 类会被
	// 站点主题脚本按存储偏好回退，导致同页深/淡混排。initScript 按注册顺序执行，
	// 后注册的 dark 生效。
	await page.addInitScript((v) => {
		try {
			localStorage.setItem("theme", v);
		} catch {}
	}, mode.name);
	for (const p of PAGES) {
		const label = `${mode.name} ${p}`;
		try {
			await page.goto(BASE + p, { waitUntil: "load", timeout: 45000 });
			await page.waitForTimeout(1200);
			// 按视口滚动取样：fixed/sticky 元素在整页截图中只渲染在顶部，坐标会错位，
			// 因此改用「视口截图 + 视口坐标」逐屏采集（各屏按 文本|字号 去重）
			const seen = new Set();
			const low = [];
			let total = 0;
			for (const frac of [0, 0.5, 1]) {
				await page.evaluate((f) => {
					const h = Math.max(
						0,
						document.documentElement.scrollHeight - window.innerHeight,
					);
					window.scrollTo(0, Math.round(h * f));
				}, frac);
				await page.waitForTimeout(800);
				const cands = await page.evaluate(collect);
				if (!Array.isArray(cands)) throw new Error("候选采集失败");
				if (!cands.length) continue;
				const buf = await page.screenshot();
				const b64 = buf.toString("base64");
				const sampled = await page.evaluate(sample, { b64, cands, vw: VW });
				if (!Array.isArray(sampled)) throw new Error("取样失败");
				for (const s of sampled) {
					const k = `${s.text}|${s.size}`;
					if (seen.has(k)) continue;
					seen.add(k);
					total++;
					if (s.ratio !== null && s.ratio < s.need) low.push(s);
				}
			}
			report.push({ page: p, mode: mode.name, total, low });
			console.log(`${label} 候选 ${total} / 不达标 ${low.length}`);
			for (const x of low.slice(0, 5))
				console.log(
					`   "${x.text}" r=${x.ratio}/${x.need} ${x.size}px fg=rgb(${x.fg}) bg=rgb(${x.bg})`,
				);
		} catch (e) {
			report.push({
				page: p,
				mode: mode.name,
				error: String(e.message).slice(0, 120),
			});
			console.log(`${label} 出错: ${String(e.message).slice(0, 120)}`);
		}
	}
}
await browser.close();
writeFileSync(OUT, JSON.stringify(report, null, 2));
const all = report.flatMap((r) =>
	(r.low || []).map((x) => ({ page: r.page, mode: r.mode, ...x })),
);
const byText = new Map();
for (const x of all) {
	const k = `${x.mode}|${x.text}|${x.ratio}`;
	if (!byText.has(k)) byText.set(k, { ...x, pages: [x.page] });
	else byText.get(k).pages.push(x.page);
}
console.log(
	`\n=== 合计不达标 ${all.length} 条（去重 ${byText.size} 项）→ ${OUT} ===`,
);
for (const v of [...byText.values()].sort((a, b) => a.ratio - b.ratio))
	console.log(
		`[${v.mode}] r=${v.ratio}/${v.need} ${v.size}px "${v.text}" fg=rgb(${v.fg}) bg=rgb(${v.bg}) [${v.pages.length} 页]`,
	);

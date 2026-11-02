// /admin 专项审计：视觉/UX/IA/响应式/可访问性/实现质量（真实无头 + 登录）
// 用法: node scripts/qa/admin-audit.mjs <base> [--suite=settings]
// --suite=settings：只枚举设置页分类与各组别（原 admin-settings-audit.mjs 并入）

import { writeFileSync } from "node:fs";
import { launchBrowser, login } from "./lib.mjs";

const BASE = process.argv[2] || "http://localhost:9023";
const SUITE = process.argv.includes("--suite=settings") ? "settings" : "default";
const OUT = "/tmp/admin-audit.json";
const PAGES = [
	["/admin/", "仪表盘"],
	["/admin/posts/", "文章列表"],
	["/admin/new/", "新建文章"],
	["/admin/gallery/", "相册"],
	["/admin/links/", "友链"],
	["/admin/notice/", "公告"],
	["/admin/dynamics/", "动态"],
	["/admin/settings/", "设置"],
];
const VIEWPORTS = [
	{ tag: "desktop", width: 1440, height: 900, touch: false },
	{ tag: "tablet", width: 834, height: 1112, touch: true },
	{ tag: "mobile", width: 375, height: 667, touch: true },
];
const rep = {
	overflow: [],
	touch: [],
	a11y: [],
	console: [],
	ia: {},
	layout: {},
	focus: [],
};

const PROBE = `(() => {
	const effPE = (el) => { let c = el; while (c && c !== document.body) { if (getComputedStyle(c).pointerEvents === "none") return "none"; c = c.parentElement; } return "auto"; };
	const isInteractive = (el) => { const t = el.tagName; if (t === "A" || t === "BUTTON" || t === "INPUT" || t === "SELECT" || t === "TEXTAREA" || t === "SUMMARY") return true; const r = el.getAttribute("role"); return !!(r && /button|link|menuitem|tab|checkbox|switch/.test(r)); };
	const hidden = (el) => !!el.closest("[inert]") || (el.checkVisibility && !el.checkVisibility());
	return { effPE, isInteractive, hidden };
})()`;

async function runSettings() {
	const { browser, page } = await launchBrowser({ width: 1440, height: 900 });
	try {
		await login(page, BASE);
		await page.goto(BASE + "/admin/settings/", {
			waitUntil: "load",
			timeout: 45000,
		});
		await page.waitForTimeout(3000);
		// 打开侧栏设置子菜单
		const s3 = page.locator(".s3parent");
		if (await s3.count()) {
			await s3.first().click();
			await page.waitForTimeout(800);
		}
		const cats = await page.locator(".s3cat").allTextContents();
		console.log("分类标签:", JSON.stringify(cats));
		const groups = {};
		for (let ci = 0; ci < cats.length; ci++) {
			const cat = page.locator(".s3cat").nth(ci);
			if (!(await cat.count())) continue;
			await cat.click();
			await page.waitForTimeout(1500);
			const items = await page.locator(".settings-nav .sn").allTextContents();
			groups[cats[ci]] = items;
			console.log(`【${cats[ci]}】组别(${items.length}):`, items.join(" | "));
		}
		writeFileSync(OUT, JSON.stringify({ suite: "settings", cats, groups }, null, 1));
		console.log(`→ ${OUT}`);
	} catch (e) {
		console.error("settings suite 失败:", e.message.slice(0, 70));
		process.exitCode = 1;
	} finally {
		await browser.close();
	}
	process.exit(0);
}

async function run() {
	if (SUITE === "settings") return runSettings();
	for (const vp of VIEWPORTS) {
		const { browser, page, errors } = await launchBrowser(
			{ width: vp.width, height: vp.height },
			{ hasTouch: vp.touch, isMobile: vp.touch && vp.width < 800 },
		);
		try {
			await login(page, BASE);
		} catch (e) {
			rep.console.push({
				vp: vp.tag,
				err: "登录失败 " + e.message.slice(0, 60),
			});
			await browser.close();
			continue;
		}
		for (const [route, name] of PAGES) {
			const before = errors.length;
			try {
				await page.goto(BASE + route, { waitUntil: "load", timeout: 45000 });
				await page.waitForTimeout(1600);
				const r = await page.evaluate((probeSrc) => {
					const { effPE, isInteractive, hidden } = eval(probeSrc);
					const out = {
						docW: document.documentElement.scrollWidth,
						winW: window.innerWidth,
						offenders: [],
						small: [],
						unnamed: [],
						noLabel: [],
						headings: [],
						contrast: [],
					};
					out.offenders = [...document.querySelectorAll("*")]
						.filter(
							(el) => el.getBoundingClientRect().right > window.innerWidth + 2,
						)
						.slice(0, 5)
						.map((el) => el.tagName + "." + String(el.className).slice(0, 26));
					for (const el of document.querySelectorAll("*")) {
						if (!isInteractive(el)) continue;
						if (effPE(el) === "none" || hidden(el)) continue;
						const r2 = el.getBoundingClientRect();
						const cs = getComputedStyle(el);
						if (
							r2.width === 0 ||
							r2.height === 0 ||
							r2.bottom < 0 ||
							r2.top > window.innerHeight
						)
							continue;
						const inlineTextLink =
							el.tagName === "A" &&
							cs.display.startsWith("inline") &&
							!el.querySelector("img,svg");
						if (!inlineTextLink && (r2.width < 44 || r2.height < 44))
							out.small.push({
								sel:
									el.tagName +
									(el.id ? "#" + el.id : "") +
									"." +
									String(el.className).slice(0, 30),
								w: Math.round(r2.width),
								h: Math.round(r2.height),
								t: (el.textContent || "").trim().slice(0, 12),
							});
						const nm =
							(
								el.getAttribute("aria-label") ||
								el.getAttribute("title") ||
								el.textContent ||
								""
							).trim() ||
							el.querySelector("img[alt]")?.getAttribute("alt") ||
							"";
						if (!nm)
							out.unnamed.push(
								el.tagName +
									(el.id ? "#" + el.id : "") +
									"." +
									String(el.className).slice(0, 28),
							);
					}
					for (const inp of document.querySelectorAll(
						"input:not([type=hidden]), select, textarea",
					)) {
						if (hidden(inp)) continue;
						const id = inp.getAttribute("id");
						const ok =
							(id && document.querySelector('label[for="' + id + '"]')) ||
							inp.closest("label") ||
							inp.getAttribute("aria-label") ||
							inp.getAttribute("aria-labelledby") ||
							inp.getAttribute("placeholder") ||
							inp.getAttribute("title");
						if (!ok)
							out.noLabel.push(
								inp.tagName +
									(id ? "#" + id : "") +
									"." +
									String(inp.className).slice(0, 24),
							);
					}
					out.headings = [...document.querySelectorAll("h1,h2,h3,h4")]
						.map(
							(h) =>
								h.tagName + ":" + (h.textContent || "").trim().slice(0, 14),
						)
						.slice(0, 12);
					// 对比度（canvas 解析任意色彩空间）
					const cv = document.createElement("canvas").getContext("2d");
					const toRgb = (c) => {
						try {
							cv.fillStyle = "#000";
							cv.fillStyle = c;
							const s = cv.fillStyle;
							if (s.startsWith("#")) {
								const n = Number.parseInt(s.slice(1), 16);
								return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
							}
							const m = s.match(/[\d.]+/g).map(Number);
							return [m[0], m[1], m[2], m.length > 3 ? m[3] : 1];
						} catch {
							return null;
						}
					};
					const lum = (rgb) => {
						const [r3, g3, b3] = rgb.slice(0, 3).map((v) => {
							v /= 255;
							return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
						});
						return 0.2126 * r3 + 0.7152 * g3 + 0.0722 * b3;
					};
					const findBg = (el) => {
						let c = el;
						while (c) {
							const col = toRgb(getComputedStyle(c).backgroundColor);
							if (col && col[3] > 0.5) return col;
							c = c.parentElement;
						}
						return [255, 255, 255, 1];
					};
					for (const el of [
						...document.querySelectorAll(
							"label, p, span, td, th, a, button, h1, h2, h3, li",
						),
					].slice(0, 600)) {
						const txt = (el.textContent || "").trim();
						if (txt.length < 4 || txt.length > 70) continue;
						if (
							el.closest("[inert]") ||
							(el.checkVisibility && !el.checkVisibility())
						)
							continue;
						if (el.children.length > 0) continue;
						const cs = getComputedStyle(el);
						const fg = toRgb(cs.color);
						const bg = findBg(el);
						if (!fg || fg[3] < 0.5) continue;
						const L1 = lum(fg),
							L2 = lum(bg);
						const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
						const size = Number.parseFloat(cs.fontSize) || 16,
							bold = Number(cs.fontWeight) >= 700;
						const need = size >= 24 || (size >= 18.66 && bold) ? 3 : 4.5;
						if (ratio < need)
							out.contrast.push({
								t: txt.slice(0, 14),
								r: Number(ratio.toFixed(2)),
								need,
								size: Math.round(size),
							});
						if (out.contrast.length > 6) break;
					}
					return out;
				}, PROBE);
				if (r.docW > r.winW + 2)
					rep.overflow.push({
						vp: vp.tag,
						page: name,
						docW: r.docW,
						winW: r.winW,
						offenders: r.offenders,
					});
				if (r.small.length)
					rep.touch.push({
						vp: vp.tag,
						page: name,
						items: r.small.slice(0, 5),
					});
				if (r.unnamed.length || r.noLabel.length || r.contrast.length)
					rep.a11y.push({
						vp: vp.tag,
						page: name,
						unnamed: r.unnamed.slice(0, 4),
						noLabel: r.noLabel.slice(0, 4),
						contrast: r.contrast.slice(0, 4),
					});
				if (vp.tag === "desktop" && route === "/admin/")
					rep.layout = {
						...rep.layout,
						sidebarW: await page.evaluate(() => {
							const el = document.querySelector(
								"#admin-sidebar, .admin-sidebar, aside",
							);
							return el ? Math.round(el.getBoundingClientRect().width) : null;
						}),
						headings: r.headings,
					};
				const errs = errors
					.slice(before)
					.filter((e) => !/favicon|net::ERR|Failed to fetch/i.test(e));
				if (errs.length)
					rep.console.push({ vp: vp.tag, page: name, errs: errs.slice(0, 2) });
			} catch (e) {
				rep.console.push({
					vp: vp.tag,
					page: name,
					err: e.message.slice(0, 70),
				});
			}
		}
		// 键盘可达性：Tab 前 12 个焦点是否可见
		try {
			await page.goto(BASE + "/admin/settings/", {
				waitUntil: "load",
				timeout: 45000,
			});
			await page.waitForTimeout(1200);
			const tabs = [];
			for (let i = 0; i < 12; i++) {
				await page.keyboard.press("Tab");
				const info = await page.evaluate(() => {
					const el = document.activeElement;
					if (!el) return null;
					const cs = getComputedStyle(el);
					return {
						tag: el.tagName,
						outline: cs.outlineStyle !== "none" && cs.outlineWidth !== "0px",
						shadow: cs.boxShadow !== "none",
						visible: el.checkVisibility ? el.checkVisibility() : true,
					};
				});
				if (info) tabs.push(info);
			}
			rep.focus.push({
				vp: vp.tag,
				noVisibleFocus: tabs.filter((t) => !t.outline && !t.shadow).length,
				total: tabs.length,
			});
		} catch {}
		await browser.close();
	}
	// IA：导航分组与条目
	const { browser, page } = await launchBrowser({ width: 1440, height: 900 });
	try {
		await login(page, BASE);
		await page.goto(BASE + "/admin/", { waitUntil: "load", timeout: 45000 });
		await page.waitForTimeout(1500);
		rep.ia = await page.evaluate(() => ({
			groups: [
				...document.querySelectorAll(
					"aside h2, aside .nav-group-title, aside [class*=group]",
				),
			]
				.map((e) => (e.textContent || "").trim().slice(0, 12))
				.filter(Boolean)
				.slice(0, 10),
			items: [...document.querySelectorAll("aside a[href^='/admin']")].map(
				(a) => ({
					label: (a.textContent || "").trim().slice(0, 12),
					href: a.getAttribute("href"),
				}),
			),
			hasSearch: !!document.querySelector(
				"aside input[type=search], aside input[type=text]",
			),
			hasBreadcrumb: !!document.querySelector(
				"[class*=breadcrumb], nav[aria-label*=breadcrumb]",
			),
		}));
	} catch {}
	await browser.close();
	writeFileSync(OUT, JSON.stringify(rep, null, 1));
	const n = (k) => rep[k].length;
	console.log(
		`overflow=${n("overflow")} touch=${n("touch")} a11y=${n("a11y")} console=${n("console")} focus=${JSON.stringify(rep.focus)}`,
	);
	console.log(
		`IA: 分组 ${rep.ia.groups?.length} / 条目 ${rep.ia.items?.length} / 搜索框 ${rep.ia.hasSearch} / 面包屑 ${rep.ia.hasBreadcrumb}`,
	);
	console.log(`→ ${OUT}`);
	process.exit(0);
}
await run();

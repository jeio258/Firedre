// 移动端/桌面端交互与可访问性排查（v2：排除 pointer-events:none 与关闭面板的误报）
// 用法: node scripts/qa/site-audit.mjs <base> [--json 输出文件]

import { writeFileSync } from "node:fs";
import { launchBrowser } from "./lib.mjs";

const BASE = process.argv[2] || "http://localhost:8973";
const OUT = process.argv[3] || "/tmp/site-audit.json";
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
];
const report = {
	touch: [],
	overlap: [],
	overflow: [],
	a11y: [],
	seo: [],
	links: {},
	tap: [],
	harness: [],
};

// 页面内通用探针：只在「有效可交互」元素上判定
const PROBE = (mode) => (mode) => mode;

async function gotoRetry(page, url) {
	for (let i = 0; i < 2; i++) {
		try {
			return await page.goto(url, { waitUntil: "load", timeout: 45000 });
		} catch (e) {
			if (i === 1) throw e;
			await page.waitForTimeout(1500);
		}
	}
}

async function mobileChecks() {
	const { browser, page } = await launchBrowser(
		{ width: 390, height: 844 },
		{ hasTouch: true, isMobile: true },
	);
	for (const p of PAGES) {
		try {
			await gotoRetry(page, BASE + p);
			await page.waitForTimeout(1100);
			const r = await page.evaluate(() => {
				const effectivePE = (el) => {
					let cur = el;
					while (cur && cur !== document.body) {
						if (getComputedStyle(cur).pointerEvents === "none") return "none";
						cur = cur.parentElement;
					}
					return "auto";
				};
				const hiddenByState = (el) =>
					!!el.closest("[inert]") ||
					el.closest('[aria-hidden="true"]') !== null;
				const isInteractive = (el) => {
					const t = el.tagName;
					if (
						t === "A" ||
						t === "BUTTON" ||
						t === "INPUT" ||
						t === "SELECT" ||
						t === "TEXTAREA" ||
						t === "SUMMARY"
					)
						return true;
					const role = el.getAttribute("role");
					return !!(
						role && /button|link|menuitem|tab|checkbox|switch/.test(role)
					);
				};
				const small = [],
					covered = [];
				for (const el of document.querySelectorAll("*")) {
					if (!isInteractive(el)) continue;
					if (effectivePE(el) === "none") continue; // 不可交互（含关闭面板）
					if (hiddenByState(el)) continue; // inert / aria-hidden
					if (el.checkVisibility && !el.checkVisibility()) continue;
					const rect = el.getBoundingClientRect();
					const cs = getComputedStyle(el);
					if (rect.width === 0 || rect.height === 0) continue;
					if (rect.bottom < 0 || rect.top > window.innerHeight) continue;
					// 触控热区：行内文本链接按 WCAG 2.5.8 例外
					const inlineTextLink =
						el.tagName === "A" &&
						cs.display.startsWith("inline") &&
						!el.querySelector("img,svg");
					if (!inlineTextLink && (rect.width < 44 || rect.height < 44)) {
						small.push({
							sel:
								el.tagName +
								(el.id ? "#" + el.id : "") +
								"." +
								String(el.className).slice(0, 34),
							w: Math.round(rect.width),
							h: Math.round(rect.height),
							text: (el.textContent || "").trim().slice(0, 14),
						});
					}
					// 遮挡：中心点最上层既非自身/后代，且该层自身可点击（PE != none）
					const cx = Math.min(
						Math.max(rect.left + rect.width / 2, 1),
						window.innerWidth - 1,
					);
					const cy = Math.min(
						Math.max(rect.top + rect.height / 2, 1),
						window.innerHeight - 1,
					);
					const top = document.elementFromPoint(cx, cy);
					if (top && top !== el && !el.contains(top) && !top.contains(el)) {
						if (getComputedStyle(top).pointerEvents !== "none") {
							covered.push({
								sel: el.tagName + (el.id ? "#" + el.id : ""),
								by: top.tagName + "." + String(top.className).slice(0, 30),
								w: Math.round(rect.width),
								h: Math.round(rect.height),
								text: (el.textContent || "").trim().slice(0, 14),
							});
						}
					}
				}
				const docW = document.documentElement.scrollWidth;
				return {
					small,
					covered,
					overflow: {
						docW,
						winW: window.innerWidth,
						offenders: [...document.querySelectorAll("*")]
							.filter(
								(el) =>
									el.getBoundingClientRect().right > window.innerWidth + 2,
							)
							.slice(0, 4)
							.map(
								(el) => `${el.tagName}.${String(el.className).slice(0, 22)}`,
							),
					},
				};
			});
			if (r.small.length) report.touch.push({ page: p, items: r.small });
			if (r.covered.length) report.overlap.push({ page: p, items: r.covered });
			if (r.overflow.docW > r.overflow.winW + 2)
				report.overflow.push({ page: p, ...r.overflow });
		} catch (e) {
			report.harness.push({
				page: p,
				fn: "mobile",
				err: e.message.slice(0, 70),
			});
		}
	}
	await browser.close();
}

async function tapChecks() {
	const { browser, page } = await launchBrowser(
		{ width: 390, height: 844 },
		{ hasTouch: true, isMobile: true },
	);
	const cases = [
		[
			"抽屉开关",
			async () => {
				await page.tap("#nav-menu-switch");
				await page.waitForTimeout(900);
				const open = await page.evaluate(() => {
					const el = document.querySelector("#nav-menu-panel");
					const r = el?.getBoundingClientRect();
					return !!r && r.width > 0 && !el.hasAttribute("inert");
				});
				if (open) {
					await page.evaluate(() =>
						document.querySelector(".mobile-menu-scrim")?.click(),
					);
					await page.waitForTimeout(600);
				}
				return open;
			},
		],
		[
			"主题面板",
			async () => {
				await page.tap("#scheme-switch");
				await page.waitForTimeout(800);
				const open = await page.evaluate(() => {
					const el = document.querySelector("#theme-mode-panel");
					return !!el && !el.hasAttribute("inert");
				});
				await page.evaluate(() =>
					document.querySelector("#scheme-switch")?.click(),
				);
				await page.waitForTimeout(400);
				return open;
			},
		],
		[
			"音乐面板（点击后初始化）",
			async () => {
				await page.tap("#music-player-switch");
				await page.waitForTimeout(6000);
				return page.evaluate(
					() => !!window.__fireflyMusic?.getState?.()?.initialized,
				);
			},
		],
		[
			"展示设置面板",
			async () => {
				if ((await page.locator("#display-settings-switch").count()) === 0)
					return true;
				await page.tap("#display-settings-switch");
				await page.waitForTimeout(900);
				const open = await page.evaluate(() => {
					const el = document.querySelector("#display-setting");
					return !!el && !el.hasAttribute("inert");
				});
				await page.evaluate(() =>
					document.querySelector("#display-settings-switch")?.click(),
				);
				return open;
			},
		],
		[
			"导航链接跳转",
			async () => {
				const href = await page.evaluate(
					() =>
						[...document.querySelectorAll('#navbar a[href^="/"]')]
							.find((a) => a.getBoundingClientRect().width > 0)
							?.getAttribute("href") || null,
				);
				if (!href) return false;
				await page.evaluate(
					(h) => document.querySelector(`a[href="${h}"]`)?.click(),
					href,
				);
				await page.waitForTimeout(2200);
				return page.evaluate(
					(h) => location.pathname.startsWith(h.replace(/\/$/, "")),
					href,
				);
			},
		],
		[
			"回到顶部",
			async () => {
				await page.evaluate(() => window.scrollTo(0, 3000));
				await page.waitForTimeout(700);
				const before = await page.evaluate(() => window.scrollY);
				await page.evaluate(() =>
					document.querySelector("#back-to-top-btn")?.click(),
				);
				await page.waitForTimeout(1600);
				return (await page.evaluate(() => window.scrollY)) < before;
			},
		],
	];
	for (const [name, act] of cases) {
		try {
			if (/^about:blank$/.test(page.url())) await gotoRetry(page, BASE + "/");
			report.tap.push({ name, ok: !!(await act()) });
		} catch (e) {
			report.tap.push({ name, ok: false, err: e.message.slice(0, 70) });
		}
	}
	await browser.close();
}

async function a11yChecks() {
	const { browser, page } = await launchBrowser({ width: 1440, height: 900 });
	for (const p of PAGES) {
		try {
			await gotoRetry(page, BASE + p);
			await page.waitForTimeout(800);
			const r = await page.evaluate(() => {
				const out = {
					imgNoAlt: [],
					btnNoName: [],
					inputNoLabel: [],
					headingSkip: [],
					contrast: [],
				};
				for (const img of document.querySelectorAll("img"))
					if (!img.hasAttribute("alt"))
						out.imgNoAlt.push(String(img.getAttribute("src")).slice(0, 46));
				for (const el of document.querySelectorAll(
					"button, [role=button], a[href]",
				)) {
					if (el.closest("[inert]")) continue;
					const name =
						(
							el.getAttribute("aria-label") ||
							el.getAttribute("title") ||
							el.textContent ||
							""
						).trim() ||
						el.querySelector("img[alt]")?.getAttribute("alt") ||
						"";
					if (!name)
						out.btnNoName.push(
							el.tagName +
								(el.id ? "#" + el.id : "") +
								"." +
								String(el.className).slice(0, 28),
						);
				}
				for (const inp of document.querySelectorAll(
					"input:not([type=hidden]), select, textarea",
				)) {
					const id = inp.getAttribute("id");
					const ok =
						(id && document.querySelector(`label[for="${id}"]`)) ||
						inp.closest("label") ||
						inp.getAttribute("aria-label") ||
						inp.getAttribute("aria-labelledby") ||
						inp.getAttribute("placeholder");
					if (!ok) out.inputNoLabel.push(inp.tagName + (id ? "#" + id : ""));
				}
				const hs = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].map(
					(h) => Number(h.tagName[1]),
				);
				for (let i = 1; i < hs.length; i++)
					if (hs[i] - hs[i - 1] > 1) {
						out.headingSkip.push(`h${hs[i - 1]}→h${hs[i]}`);
						break;
					}
				// 颜色解析：用 canvas 把 oklch/color-mix 等解析成 rgb；
				// 哨兵值检测解析失败（如浏览器不支持 oklch）→ 返回 null 跳过，避免 fg==bg 误报
				// 颜色→sRGB：用 1×1 canvas 绘制后回读像素，强制把 oklch/oklab/color-mix
				// 等转换为 sRGB（注：canvas.fillStyle 会原样回写这些色彩空间，直接正则取数会得到
				// rgb(0.95,0.01,165) 这类垃圾值→亮度全错）；哨兵值检测解析失败→null 跳过
				const cvs = document.createElement("canvas");
				cvs.width = 1;
				cvs.height = 1;
				const cv = cvs.getContext("2d", { willReadFrequently: true });
				const SENTINEL = "#010203";
				const toRgb = (c) => {
					try {
						cv.globalCompositeOperation = "copy";
						cv.fillStyle = SENTINEL;
						cv.fillStyle = c;
						if (String(cv.fillStyle).toLowerCase() === SENTINEL) return null;
						cv.fillRect(0, 0, 1, 1);
						const d = cv.getImageData(0, 0, 1, 1).data;
						return [d[0], d[1], d[2], d[3] / 255];
					} catch {
						return null;
					}
				};
				const over = (top, bottom) => {
					const a = top[3];
					return [
						top[0] * a + bottom[0] * (1 - a),
						top[1] * a + bottom[1] * (1 - a),
						top[2] * a + bottom[2] * (1 - a),
						1,
					];
				};
				const lum = (rgb) => {
					const [r, g, b] = rgb.slice(0, 3).map((v) => {
						v /= 255;
						return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
					});
					return 0.2126 * r + 0.7152 * g + 0.0722 * b;
				};
				// 背景：逐级向上收集半透明层，以白底为基础自下而上合成，命中完全不透明层即止
				const findBg = (el) => {
					const layers = [];
					let cur = el;
					while (cur) {
						const c = toRgb(getComputedStyle(cur).backgroundColor);
						if (c === null) return null;
						if (c[3] > 0) layers.push(c);
						if (c[3] > 0.999) break;
						cur = cur.parentElement;
					}
					let base = [255, 255, 255, 1];
					for (let i = layers.length - 1; i >= 0; i--)
						base = over(layers[i], base);
					return base;
				};
				for (const el of [
					...document.querySelectorAll("p, li, a, button, span, h1, h2, h3"),
				].slice(0, 500)) {
					const txt = (el.textContent || "").trim();
					if (txt.length < 4 || txt.length > 80) continue;
					if (
						el.closest("[inert]") ||
						(el.checkVisibility && !el.checkVisibility())
					)
						continue;
					const cs = getComputedStyle(el);
					if (cs.textDecoration.includes("underline")) continue;
					const fgRaw = toRgb(cs.color);
					const bg = findBg(el);
					if (!fgRaw || !bg || fgRaw[3] <= 0) continue;
					const fg = over(fgRaw, bg); // 半透明文字（如 .text-50）按实际叠加计算
					const L1 = lum(fg),
						L2 = lum(bg);
					const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
					const size = Number.parseFloat(cs.fontSize) || 16;
					const bold = Number(cs.fontWeight) >= 700;
					const large = size >= 24 || (size >= 18.66 && bold);
					const need = large ? 3 : 4.5;
					if (ratio < need)
						out.contrast.push({
							t: txt.slice(0, 16),
							r: Number(ratio.toFixed(2)),
							need,
							size: Math.round(size),
						});
					if (out.contrast.length > 5) break;
				}
				return out;
			});
			if (
				r.imgNoAlt.length ||
				r.btnNoName.length ||
				r.inputNoLabel.length ||
				r.headingSkip.length ||
				r.contrast.length
			)
				report.a11y.push({ page: p, ...r });
		} catch (e) {
			report.harness.push({ page: p, fn: "a11y", err: e.message.slice(0, 70) });
		}
	}
	await browser.close();
}

async function seoChecks() {
	const { browser, page } = await launchBrowser({ width: 1440, height: 900 });
	for (const p of PAGES) {
		try {
			const resp = await gotoRetry(page, BASE + p);
			await page.waitForTimeout(600);
			const r = await page.evaluate(() => ({
				title: (document.title || "").length,
				desc:
					document
						.querySelector('meta[name="description"]')
						?.getAttribute("content")?.length || 0,
				canonical: !!document.querySelector('link[rel="canonical"]'),
				og: !!document.querySelector('meta[property="og:title"]'),
				viewport:
					document
						.querySelector('meta[name="viewport"]')
						?.getAttribute("content") || "",
				lang: document.documentElement.lang || "",
				h1: document.querySelectorAll("h1").length,
				jsonld: document.querySelectorAll('script[type="application/ld+json"]')
					.length,
			}));
			const issues = [];
			if (!r.title) issues.push("缺 title");
			if (r.title > 60) issues.push(`title 过长(${r.title})`);
			if (!r.desc) issues.push("缺 description");
			if (!r.canonical) issues.push("缺 canonical");
			if (!r.og) issues.push("缺 og:title");
			if (!/width=device-width/.test(r.viewport))
				issues.push("viewport 缺 width=device-width");
			if (r.h1 !== 1) issues.push(`h1=${r.h1}`);
			if (!r.lang) issues.push("缺 html lang");
			if (issues.length)
				report.seo.push({ page: p, status: resp?.status(), issues });
		} catch (e) {
			report.harness.push({ page: p, fn: "seo", err: e.message.slice(0, 70) });
		}
	}
	await browser.close();
}

// 链接与元信息：纯 fetch（不依赖浏览器，避免 workerd 崩溃污染）
async function linkChecks() {
	const seen = new Map();
	const bad = [];
	for (const start of [
		"/",
		"/posts/firedre/",
		"/gallery/",
		"/about/",
		"/archive/",
	]) {
		let html = "";
		try {
			html = await (await fetch(BASE + start)).text();
		} catch {
			continue;
		}
		const hrefs = [...html.matchAll(/href="(\/[^"#?]*)/g)]
			.map((m) => m[1])
			.filter(
				(h) =>
					!/\.(png|jpe?g|webp|avif|svg|ico|txt|xml|json|js|css|woff2?)$/i.test(
						h,
					),
			);
		for (const h of new Set(hrefs)) {
			if (seen.has(h)) continue;
			seen.set(h, start);
			try {
				const res = await fetch(BASE + h, { redirect: "follow" });
				if (res.status >= 400)
					bad.push({ from: start, to: h, status: res.status });
			} catch (e) {
				bad.push({ from: start, to: h, err: e.message.slice(0, 40) });
			}
		}
	}
	report.links = { checked: seen.size, bad };
	// 站点级文件
	for (const f of ["/robots.txt", "/sitemap.xml", "/rss.xml"]) {
		try {
			const r = await fetch(BASE + f);
			report.links[f] = r.status;
		} catch {
			report.links[f] = "ERR";
		}
	}
}

await mobileChecks();
await tapChecks();
await a11yChecks();
await seoChecks();
await linkChecks();

writeFileSync(OUT, JSON.stringify(report, null, 1));
const n = (k) => (Array.isArray(report[k]) ? report[k].length : 0);
console.log(
	`touch=${n("touch")} overlap=${n("overlap")} overflow=${n("overflow")} a11y=${n("a11y")} seo=${n("seo")} tap=${report.tap.filter((t) => t.ok).length}/${report.tap.length} links=${report.links.checked}/bad=${report.links.bad?.length} harness=${n("harness")}`,
);
console.log(`→ ${OUT}`);
process.exit(0);

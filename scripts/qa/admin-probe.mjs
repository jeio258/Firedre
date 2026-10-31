// /admin 无障碍精确探针 v2：等待 hydrate、逐元素决定性判定、3 断点、可选展开面板
// 用法: node scripts/qa/admin-probe.mjs <base>
import { launchBrowser, login } from "./lib.mjs";

const BASE = process.argv[2] || "http://localhost:9027";
const PAGES = [
	"/admin/",
	"/admin/posts/",
	"/admin/new/",
	"/admin/settings/",
	"/admin/gallery/",
	"/admin/links/",
	"/admin/notice/",
	"/admin/dynamics/",
	"/admin/sitelinks/",
	"/admin/about/",
];
const VP = [
	{ tag: "desktop", width: 1440, height: 900, touch: false },
	{ tag: "tablet", width: 834, height: 1112, touch: true }, // 补齐平板盲区
	{ tag: "mobile", width: 375, height: 667, touch: true },
];
const rep = {
	hydrated: {},
	focus: [],
	noLabel: [],
	unnamed: [],
	touch: [],
	overflow: [],
};

const waitHydrated = async (page) => {
	try {
		await page.waitForSelector("a.nav-item, .admin-shell, #admin-app", {
			timeout: 20000,
		});
		return true;
	} catch {
		return false;
	}
};

for (const vp of VP) {
	const { browser, page } = await launchBrowser(
		{ width: vp.width, height: vp.height },
		{ hasTouch: vp.touch, isMobile: vp.touch && vp.width < 800 },
	);
	try {
		await login(page, BASE);
	} catch {
		await browser.close();
		continue;
	}
	for (const route of PAGES) {
		try {
			await page.goto(BASE + route, { waitUntil: "load", timeout: 45000 });
			const ok = await waitHydrated(page);
			rep.hydrated[vp.tag + route] = ok;
			await page.waitForTimeout(900);
			// 移动端：展开抽屉以覆盖抽屉内控件
			if (vp.touch) {
				await page.evaluate(() => {
					const btn = document.querySelector(
						"[class*=menu-toggle], .hamburger, #admin-menu-toggle, button[aria-label*=菜单]",
					);
					btn?.click();
				});
				await page.waitForTimeout(700);
			}
			const r = await page.evaluate(() => {
				const out = {
					decisive: {},
					noLabel: [],
					unnamed: [],
					small: [],
					offenders: [],
				};
				// 逐元素决定性判定（focus 后读 outline/box-shadow）
				const probe = (sel, key) => {
					const el = document.querySelector(sel);
					if (!el) {
						out.decisive[key] = "元素不存在";
						return;
					}
					el.focus();
					const cs = getComputedStyle(el);
					out.decisive[key] = {
						outline:
							cs.outlineStyle !== "none" &&
							Number.parseFloat(cs.outlineWidth) > 0
								? `${cs.outlineWidth} ${cs.outlineStyle}`
								: null,
						shadow: cs.boxShadow !== "none" ? cs.boxShadow.slice(0, 34) : null,
					};
				};
				probe("a.nav-item", "navLink");
				probe(".btn, button.btn", "button");
				probe(".sw", "switch");
				probe("a[href]:not(.nav-item)", "plainLink");
				// 无标签字段（label/aria/placeholder 全无）
				for (const el of document.querySelectorAll(
					"input:not([type=hidden]), select, textarea",
				)) {
					const cs = getComputedStyle(el);
					if (cs.display === "none" || cs.visibility === "hidden") continue;
					const id = el.getAttribute("id");
					const ok =
						(id && document.querySelector(`label[for="${id}"]`)) ||
						el.closest("label") ||
						el.getAttribute("aria-label") ||
						el.getAttribute("aria-labelledby") ||
						el.getAttribute("placeholder");
					if (!ok) {
						const host = el.closest("[class]")?.className || "";
						out.noLabel.push({
							tag: el.tagName,
							type: el.getAttribute("type") || "",
							name: el.getAttribute("name") || "",
							cls: String(el.className).slice(0, 30),
							host: String(host).slice(0, 34),
						});
					}
				}
				// 无无障碍名（含 placeholder 也不认，看是否真正缺名）
				for (const el of document.querySelectorAll(
					"input:not([type=hidden]), select, textarea, button, a[href]",
				)) {
					const cs = getComputedStyle(el);
					if (cs.display === "none" || cs.visibility === "hidden") continue;
					const nm = (
						el.getAttribute("aria-label") ||
						el.getAttribute("aria-labelledby") ||
						el.getAttribute("title") ||
						el.textContent ||
						""
					).trim();
					if (!nm && !el.querySelector("img[alt]")) {
						const id = el.getAttribute("id");
						const lbl = id && document.querySelector(`label[for="${id}"]`);
						if (!lbl)
							out.unnamed.push({
								tag: el.tagName,
								type: el.getAttribute("type") || "",
								name: el.getAttribute("name") || "",
								ph: el.getAttribute("placeholder") || "",
								cls: String(el.className).slice(0, 30),
							});
					}
				}
				// 触控热区（仅可见可交互）
				const inter = (el) =>
					["A", "BUTTON", "INPUT", "SELECT", "TEXTAREA"].includes(el.tagName);
				for (const el of document.querySelectorAll("*")) {
					if (!inter(el)) continue;
					const cs = getComputedStyle(el);
					if (
						cs.display === "none" ||
						cs.visibility === "hidden" ||
						cs.pointerEvents === "none"
					)
						continue;
					const r2 = el.getBoundingClientRect();
					if (
						r2.width === 0 ||
						r2.height === 0 ||
						r2.top > window.innerHeight ||
						r2.bottom < 0
					)
						continue;
					const inlineText =
						el.tagName === "A" &&
						cs.display.startsWith("inline") &&
						!el.querySelector("img,svg");
					if (!inlineText && (r2.width < 44 || r2.height < 44))
						out.small.push({
							sel: el.tagName + "." + String(el.className).slice(0, 26),
							w: Math.round(r2.width),
							h: Math.round(r2.height),
							t: (el.textContent || "").trim().slice(0, 10),
						});
				}
				out.offenders = [...document.querySelectorAll("*")]
					.filter(
						(el) => el.getBoundingClientRect().right > window.innerWidth + 2,
					)
					.slice(0, 4)
					.map((el) => el.tagName + "." + String(el.className).slice(0, 24));
				return out;
			});
			if (r.decisive && !vp.touch) rep.focus.push({ route, ...r.decisive });
			if (r.noLabel.length)
				rep.noLabel.push({ vp: vp.tag, route, items: r.noLabel.slice(0, 6) });
			if (r.unnamed.length)
				rep.unnamed.push({ vp: vp.tag, route, items: r.unnamed.slice(0, 6) });
			if (r.small.length)
				rep.touch.push({ vp: vp.tag, route, items: r.small.slice(0, 40) });
			if (r.offenders.length)
				rep.overflow.push({ vp: vp.tag, route, offenders: r.offenders });
		} catch (e) {
			rep.overflow.push({ vp: vp.tag, route, err: e.message.slice(0, 60) });
		}
	}
	await browser.close();
}
console.log("=== hydrate 情况 ===");
const hyd = Object.entries(rep.hydrated);
console.log(
	`  成功 ${hyd.filter(([, v]) => v).length}/${hyd.length}`,
	hyd.filter(([, v]) => !v).slice(0, 3),
);
console.log("=== A1 决定性判定（桌面，navLink/button/switch/plainLink）===");
for (const f of rep.focus.slice(0, 5))
	console.log(
		"  ",
		f.route,
		JSON.stringify({
			navLink: f.navLink,
			button: f.button,
			sw: f.sw,
			plainLink: f.plainLink,
		}),
	);
console.log(
	`=== A2 无标签字段：${rep.noLabel.reduce((s, x) => s + x.items.length, 0)} 项 ===`,
);
for (const g of rep.noLabel.slice(0, 5))
	console.log("  ", g.vp, g.route, JSON.stringify(g.items.slice(0, 3)));
console.log(
	`=== 无无障碍名（不含 placeholder 作为名）：${rep.unnamed.reduce((s, x) => s + x.items.length, 0)} 项 ===`,
);
for (const g of rep.unnamed.slice(0, 5))
	console.log("  ", g.vp, g.route, JSON.stringify(g.items.slice(0, 3)));
// 输出完整分布（不截断）——避免"修一个冒一个"（TOP-N 会掩盖后续项）
const agg = {};
for (const g of rep.touch)
	for (const it of g.items) {
		const k = `${it.sel} ${it.w}x${it.h}`;
		agg[k] = (agg[k] || 0) + 1;
	}
console.log(
	`=== 触控热区 <44：${rep.touch.reduce((s, x) => s + x.items.length, 0)} 项，去重后 ${Object.keys(agg).length} 类（完整分布）===`,
);
Object.entries(agg)
	.sort((a, b) => b[1] - a[1])
	.forEach(([k, n]) => console.log(`  ${n}× ${k}`));
const aggNL = {};
for (const g of rep.noLabel)
	for (const it of g.items) {
		const k = `${it.tag} host=${it.host}`;
		aggNL[k] = (aggNL[k] || 0) + 1;
	}
const aggUN = {};
for (const g of rep.unnamed)
	for (const it of g.items) {
		const k = `${it.tag}.${it.cls} ph=${it.ph}`;
		aggUN[k] = (aggUN[k] || 0) + 1;
	}
console.log(`=== 无标签字段完整分布（${Object.keys(aggNL).length} 类）===`);
Object.entries(aggNL)
	.sort((a, b) => b[1] - a[1])
	.forEach(([k, n]) => console.log(`  ${n}× ${k}`));
console.log(`=== 无无障碍名完整分布（${Object.keys(aggUN).length} 类）===`);
Object.entries(aggUN)
	.sort((a, b) => b[1] - a[1])
	.forEach(([k, n]) => console.log(`  ${n}× ${k}`));
console.log(`=== 溢出：${rep.overflow.length} 项 ===`);
process.exit(0);

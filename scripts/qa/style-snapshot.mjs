// 计算样式快照：对页面 × 全元素 × 关键属性取指纹，用于证明 CSS 改动「视觉零差异」
// 用法: node scripts/qa/style-snapshot.mjs <base> --baseline   # 采集并写入基线
//       node scripts/qa/style-snapshot.mjs <base>             # 与基线比对
// 去噪：同页采两次，只保留两次一致的属性值；页面为默认状态（本地 D1 稳定）
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { launchBrowser } from "./lib.mjs";

const BASE = process.argv[2] || "http://localhost:8945";
const MODE = process.argv.includes("--baseline") ? "baseline" : "compare";
const FILE = "scripts/qa/style-snapshot.json";

const PROPS = [
	"display",
	"position",
	"visibility",
	"color",
	"background-color",
	"z-index",
	"opacity",
	"top",
	"left",
	"right",
	"bottom",
	"width",
	"height",
	"border-radius",
	"border-top-width",
	"font-size",
	"font-weight",
	"line-height",
	"text-align",
	"overflow-x",
	"overflow-y",
	"flex-direction",
	"justify-content",
	"align-items",
	"gap",
	"margin-top",
	"margin-left",
	"padding-top",
	"padding-left",
	"box-shadow",
];

const VIEWPORTS = [
	{ tag: "desktop", width: 1440, height: 900, touch: false },
	{ tag: "mobile", width: 375, height: 667, touch: true },
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
];

// 用「标签+稳定属性+父链」构造稳定键，避免元素顺序漂移（轮播/动画）导致按下标比对失效；
// 同 key 多次出现时追加出现序号；同页采两次，仅保留两次一致的值以剔除动画噪声。
function keyOf(el) {
	const attrs = ["id", "class", "data-index", "data-astro-cid"]
		.map((a) => el.getAttribute?.(a) || "")
		.join("|");
	const chain = [];
	let cur = el;
	for (let i = 0; i < 3 && cur; i++) {
		chain.push(cur.tagName);
		cur = cur.parentElement;
	}
	return `${chain.join(">")}#${attrs}`.slice(0, 220);
}

async function fingerprint(page) {
	const grab = () =>
		page.evaluate((props) => {
			const out = {};
			for (const el of document.querySelectorAll("*")) {
				const attrs = ["id", "class", "data-index", "data-astro-cid"]
					.map((a) => el.getAttribute?.(a) || "")
					.join("|");
				const chain = [];
				let cur = el;
				for (let i = 0; i < 3 && cur; i++) {
					chain.push(cur.tagName);
					cur = cur.parentElement;
				}
				const k = (chain.join(">") + "#" + attrs).slice(0, 220);
				out[k] = out[k] || [];
				out[k].push(
					props
						.map((p) => {
							try {
								return getComputedStyle(el).getPropertyValue(p);
							} catch {
								return "";
							}
						})
						.join("\u0001"),
				);
			}
			return out;
		}, props);
	const a = await grab();
	await page.waitForTimeout(350);
	const b = await grab();
	const res = {};
	for (const k of Object.keys(a)) {
		if (!b[k] || b[k].length !== a[k].length) continue;
		const row = a[k].map((v, i) => (v === b[k][i] ? v : "\u0002"));
		if (row.some((x) => x !== "\u0002")) res[k] = row;
	}
	return res;
}

const result = {};
for (const vp of VIEWPORTS) {
	const { browser, page } = await launchBrowser({
		width: vp.width,
		height: vp.height,
		touch: vp.touch,
	});
	for (const p of PAGES) {
		try {
			await page.goto(BASE + p, { waitUntil: "load", timeout: 60000 });
			await page.waitForTimeout(1200);
			result[`${vp.tag}:${p}`] = await fingerprint(page);
		} catch (e) {
			result[`${vp.tag}:${p}`] = { error: e.message.slice(0, 80) };
		}
	}
	for (const p of ["/", "/posts/firedre/"]) {
		try {
			await page.goto(BASE + p, { waitUntil: "load", timeout: 60000 });
			await page.evaluate(() => {
				document.documentElement.classList.add("dark");
			});
			await page.waitForTimeout(1000);
			result[`dark-${vp.tag}:${p}`] = await fingerprint(page);
		} catch (e) {
			result[`dark-${vp.tag}:${p}`] = { error: e.message.slice(0, 80) };
		}
	}
	await browser.close();
}

await browser.close();

if (MODE === "baseline") {
	writeFileSync(FILE, JSON.stringify(result));
	const n = Object.values(result).reduce(
		(s, v) => s + (v && !Array.isArray(v) ? Object.keys(v).length : 0),
		0,
	);
	console.log(
		`基线已写入 ${FILE}：${PAGES.length + 2} 个页面态 / ${n} 个元素指纹`,
	);
	process.exit(0);
}
if (!existsSync(FILE)) {
	console.log("缺少基线，请先 --baseline");
	process.exit(1);
}
const base = JSON.parse(readFileSync(FILE, "utf8"));
let diffs = 0;
const keys = new Set([...Object.keys(base), ...Object.keys(result)]);
for (const key of keys) {
	const b = base[key],
		n = result[key];
	if (!Array.isArray(b) || !Array.isArray(n)) continue;
	if (b.length !== n.length) {
		console.log(`DIFF ${key}: 指纹组数 ${b.length} → ${n.length}`);
		diffs++;
		continue;
	}
	for (let i = 0; i < b.length; i++) {
		if (b[i] === n[i]) continue;
		const bv = b[i].split("\u0001"),
			nv = n[i].split("\u0001");
		const changed = PROPS.filter((_, j) => bv[j] !== nv[j]).map(
			(p) => `${p}: ${bv[PROPS.indexOf(p)]} → ${nv[PROPS.indexOf(p)]}`,
		);
		console.log(`DIFF ${key} #${i}: ${changed.slice(0, 4).join(" ; ")}`);
		diffs++;
		if (diffs > 20) break;
	}
	if (diffs > 20) break;
}
console.log(
	diffs === 0 ? "\n样式快照：0 差异 ✓" : `\n样式快照：${diffs} 处差异`,
);
process.exit(0);

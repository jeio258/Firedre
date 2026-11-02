// 10 分钟重复压力测试：多轮采样线上真实站点，统计性能指标与稳定性
// 用法: node scripts/qa/stress.mjs <base> <分钟数>
//       ROUNDS=<n> 环境变量可改为按轮数停止（桌面/移动交替），忽略分钟数
import { launchBrowser } from "./lib.mjs";

const BASE = process.argv[2] || "https://firedre.994613.xyz";
const MINUTES = Number(process.argv[3] || 10);
const ROUNDS = Number(process.env.ROUNDS || 0);
const DEADLINE = ROUNDS ? Infinity : Date.now() + MINUTES * 60_000;

const stats = [];
const fails = [];
let round = 0;

const pct = (arr, p) => {
	if (!arr.length) return 0;
	const s = [...arr].sort((a, b) => a - b);
	return s[Math.min(s.length - 1, Math.floor((s.length - 1) * p))];
};
const avg = (arr) =>
	arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;

async function sample(mobile) {
	const vp = mobile
		? { width: 390, height: 844, touch: true }
		: { width: 1440, height: 900 };
	const { browser, page, errors } = await launchBrowser(vp);
	await page.addInitScript(() => {
		window.__m = { fcp: 0, lcp: 0, cls: 0, longTasks: 0, tbt: 0 };
		new PerformanceObserver((l) => {
			for (const e of l.getEntries())
				if (e.name === "first-contentful-paint")
					window.__m.fcp = Math.round(e.startTime);
		}).observe({ type: "paint", buffered: true });
		new PerformanceObserver((l) => {
			for (const e of l.getEntries()) window.__m.lcp = Math.round(e.startTime);
		}).observe({ type: "largest-contentful-paint", buffered: true });
		new PerformanceObserver((l) => {
			for (const e of l.getEntries()) window.__m.cls += e.value;
		}).observe({ type: "layout-shift", buffered: true });
		new PerformanceObserver((l) => {
			for (const e of l.getEntries()) {
				window.__m.longTasks++;
				window.__m.tbt += Math.max(0, e.duration - 50);
			}
		}).observe({ type: "longtask", buffered: true });
	});
	const out = { mobile, status: 0, ok: false, err: null };
	try {
		const t0 = Date.now();
		const resp = await page.goto(BASE + "/", {
			waitUntil: "load",
			timeout: 90000,
		});
		out.status = resp?.status() ?? 0;
		out.loadMs = Date.now() - t0;
		await page.waitForTimeout(4500);
		const m = await page.evaluate(() => {
			const nav = performance.getEntriesByType("navigation")[0];
			const res = performance.getEntriesByType("resource");
			return {
				ttfb: Math.round(nav.responseStart),
				fcp: window.__m.fcp,
				lcp: window.__m.lcp,
				cls: Number(window.__m.cls.toFixed(4)),
				tbt: Math.round(window.__m.tbt),
				longTasks: window.__m.longTasks,
				bytesKB: Math.round(
					res.reduce((s, r) => s + (r.transferSize || 0), 0) / 1024,
				),
				resCount: res.length,
				hydrated: !!document.querySelector("astro-island[ssr], astro-island"),
				dict: !!window.__FIREDRE_I18N__,
				meta: !!window.__allPostMetaCache,
			};
		});
		Object.assign(out, m);
		out.consoleErrors = errors.filter(
			(e) => !/i-meto|alcy|Failed to fetch|net::ERR|favicon/i.test(e),
		).length;
		out.ok = out.status === 200 && out.consoleErrors === 0 && m.dict && m.meta;
	} catch (e) {
		out.err = e.message.slice(0, 80);
	} finally {
		await browser.close();
	}
	return out;
}

console.log(
	`压力测试开始：${BASE}，持续 ${MINUTES} 分钟（桌面+移动交替采样）\n`,
);
while (Date.now() < DEADLINE && (ROUNDS ? round < ROUNDS : true)) {
	round++;
	const mobile = round % 2 === 0;
	const r = await sample(mobile);
	stats.push(r);
	if (!r.ok) fails.push({ round, ...r });
	const tag = mobile ? "移动" : "桌面";
	console.log(
		`#${String(round).padStart(2)} [${tag}] ${r.ok ? "OK " : "FAIL"} status=${r.status} TTFB=${r.ttfb ?? "-"}ms FCP=${r.fcp ?? "-"} LCP=${r.lcp ?? "-"} CLS=${r.cls ?? "-"} TBT=${r.tbt ?? "-"}ms 资源=${r.resCount ?? "-"} ${r.bytesKB ?? "-"}KB` +
			(r.err ? ` err=${r.err}` : ""),
	);
}

const ok = stats.filter((s) => s.ok);
const nums = (k, list = ok) =>
	list.map((s) => s[k]).filter((v) => typeof v === "number");
console.log(
	`\n===== 汇总（${stats.length} 轮，成功 ${ok.length}，失败 ${stats.length - ok.length}）=====`,
);
console.log("指标              平均    p50    p75    p95    最大");
for (const [k, label] of [
	["ttfb", "TTFB(ms)"],
	["fcp", "FCP(ms)"],
	["lcp", "LCP(ms)"],
	["tbt", "TBT(ms)"],
	["bytesKB", "字节(KB)"],
	["resCount", "请求数"],
]) {
	const v = nums(k);
	console.log(
		`${label.padEnd(16)} ${String(avg(v)).padStart(6)} ${String(pct(v, 0.5)).padStart(6)} ${String(pct(v, 0.75)).padStart(6)} ${String(pct(v, 0.95)).padStart(6)} ${String(Math.max(0, ...v)).padStart(6)}`,
	);
}
const cls = nums("cls");
console.log(`CLS 最大 ${Math.max(0, ...cls).toFixed(4)}`);
const byView = {
	桌面: ok.filter((s) => !s.mobile),
	移动: ok.filter((s) => s.mobile),
};
for (const [name, list] of Object.entries(byView)) {
	if (!list.length) continue;
	console.log(
		`  ${name}: n=${list.length} TTFB 均 ${avg(nums("ttfb", list))}ms / p95 ${pct(nums("ttfb", list), 0.95)}ms ｜ FCP 均 ${avg(nums("fcp", list))}ms ｜ LCP 均 ${avg(nums("lcp", list))}ms`,
	);
}
if (fails.length) {
	console.log("\n失败轮次明细（前 8）：");
	for (const f of fails.slice(0, 8))
		console.log(
			`  #${f.round} ${f.mobile ? "移动" : "桌面"} status=${f.status} 控制台错误=${f.consoleErrors ?? "-"} 词典=${f.dict} 元数据=${f.meta} ${f.err || ""}`,
		);
}
process.exit(0);

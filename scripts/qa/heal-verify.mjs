// 自愈重载验证：正向（正常页不重载）+ 灵敏度（阻断 CSS → 恰好重载 1 次，不死循环）
// 用法: node scripts/qa/heal-verify.mjs <base>
import { launchBrowser } from "./lib.mjs";

const BASE = process.argv[2] || "http://localhost:4321";
const ok = (l, c, e = "") =>
	console.log(`${c ? "PASS" : "FAIL"}  ${l}${e ? "  → " + e : ""}`);

async function navigations(blockCss) {
	const { browser, page } = await launchBrowser({ width: 1440, height: 900 });
	if (blockCss) await page.route("**/*.css*", (r) => r.abort());
	await page
		.goto(`${BASE}/`, { waitUntil: "load", timeout: 45000 })
		.catch(() => {});
	await page.waitForTimeout(4000);
	const state = await page
		.evaluate(() => ({
			healAt: sessionStorage.getItem("assetHealAt"),
			navType: performance.getEntriesByType("navigation")[0]?.type ?? "?",
			href: location.href,
		}))
		.catch(() => ({ healAt: null, navType: "?", href: "err" }));
	await browser.close();
	return state;
}

const normal = await navigations(false);
ok(
	"① 正常页面不触发自愈",
	!normal.healAt && normal.navType !== "reload",
	`nav=${normal.navType} healAt=${normal.healAt}`,
);

const broken = await navigations(true);
ok(
	"② 阻断 CSS → 自愈恰好重载一次（不死循环）",
	!!broken.healAt && broken.navType === "reload",
	`nav=${broken.navType} healAt=${broken.healAt}`,
);

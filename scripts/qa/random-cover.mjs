// 封面图自动获取功能实测：端点鉴权 / 正向填充 / 负向不取 / 持久化 / 编辑页不自动换图 / 主动更换
// 用法: QA_ADMIN_USER=<用户名> node scripts/qa/random-cover.mjs <base>
import { injectTestAdmin, launchBrowser, login } from "./lib.mjs";

const BASE = process.argv[2] || "http://localhost:4321";
const ok = (l, c, e = "") =>
	console.log(`${c ? "PASS" : "FAIL"}  ${l}${e ? "  → " + e : ""}`);

// 负向：未登录访问端点应 401
const anon = await fetch(`${BASE}/api/admin/random-cover/`).catch(() => ({
	status: 0,
}));
ok("负向：未登录端点 → 401", anon.status === 401, `status=${anon.status}`);

const restore = injectTestAdmin();
const { browser, page } = await launchBrowser({ width: 1440, height: 900 });
const coverInput = () => page.locator('input[placeholder^="https://"]').first();
const coverSwitch = () =>
	page.locator('button.sw[aria-label="封面图"]').first();
const coverVal = () =>
	coverInput()
		.inputValue()
		.catch(() => "(无输入框)");

try {
	const logged = await login(page, BASE);
	ok("后台登录", logged);
	if (!logged) throw new Error("登录失败，后续用例中止");

	// 端点（已登录）
	const res = await page.evaluate(async () => {
		const r = await fetch("/api/admin/random-cover/", {
			credentials: "include",
		});
		return { status: r.status, body: await r.json().catch(() => null) };
	});
	ok(
		"端点返回 {enable,url} 且 url 可用",
		res.status === 200 &&
			typeof res.body?.url === "string" &&
			(res.body.url === "" || res.body.url.startsWith("http")),
		JSON.stringify(res.body).slice(0, 140),
	);

	// 清空持久化偏好 → 新建页：开关默认关、封面为空（负向）
	await page.goto(`${BASE}/admin/posts/new/`, { waitUntil: "load" });
	await page.evaluate(() => localStorage.removeItem("admin:autoCover"));
	await page.reload({ waitUntil: "load" });
	await page.waitForTimeout(2500);
	const swCount = await coverSwitch().count();
	ok("新建页出现「封面图」开关", swCount > 0);
	const offVal = await coverVal();
	ok("负向：开关关闭时不取图（封面为空）", offVal === "", `值="${offVal}"`);

	// 正向：打开开关 → 自动填充
	await coverSwitch().click();
	await page.waitForTimeout(6000);
	const onVal = await coverVal();
	const persisted = await page.evaluate(() =>
		localStorage.getItem("admin:autoCover"),
	);
	ok(
		"正向：开关打开 → 自动填入封面（api 或图片地址）",
		onVal !== "" && (onVal === "api" || onVal.startsWith("http")),
		`值="${onVal.slice(0, 90)}"`,
	);
	ok("持久化：偏好已写入本地", persisted === "1", `localStorage=${persisted}`);

	// 持久化：重新加载新建页 → 开关仍开、且仍自动填充
	await page.reload({ waitUntil: "load" });
	await page.waitForTimeout(6000);
	const swOn = await coverSwitch().evaluate((el) =>
		el.getAttribute("aria-checked"),
	);
	const afterReload = await coverVal();
	ok(
		"持久化：刷新后开关仍为开且继续自动获取",
		swOn === "true" && afterReload !== "",
		`aria-checked=${swOn} 值="${afterReload.slice(0, 60)}"`,
	);

	// 编辑页：不应自动换图（与库中封面保持一致）
	const postCover = await page.evaluate(async () => {
		const r = await fetch("/api/posts/firedre/", { credentials: "include" });
		const j = await r.json().catch(() => ({}));
		return String(j.cover || "");
	});
	await page.goto(`${BASE}/admin/posts/edit/firedre/`, { waitUntil: "load" });
	await page.waitForTimeout(7000);
	const swCount2 = await coverSwitch().count();
	const inputCount = await coverInput().count();
	ok(
		"编辑页渲染出开关与封面输入框",
		swCount2 > 0 && inputCount > 0,
		`switch=${swCount2} input=${inputCount}`,
	);
	const editVal = await coverVal();
	const swEdit = await coverSwitch()
		.evaluate((el) => el.getAttribute("aria-checked"))
		.catch(() => null);
	ok(
		"编辑页：持久化为开但不自动换图（与库中封面一致）",
		swCount2 > 0 && swEdit === "true" && editVal === postCover,
		`aria-checked=${swEdit} 库="${postCover.slice(0, 60)}" 界面="${editVal.slice(0, 60)}"`,
	);

	// 编辑页主动更换：关→开 → 封面被替换
	await coverSwitch().click(); // 关
	await page.waitForTimeout(500);
	const afterOff = await coverVal();
	await coverSwitch().click(); // 开 → 主动更换
	await page.waitForTimeout(7000);
	const afterOn = await coverVal();
	ok(
		"编辑页主动更换：开关关→开后封面被替换",
		afterOn !== afterOff && afterOn !== "",
		`关时="${afterOff.slice(0, 50)}" 开后="${afterOn.slice(0, 70)}"`,
	);
} catch (e) {
	console.log("执行异常:", String(e).slice(0, 200));
} finally {
	await browser.close();
	restore?.();
}

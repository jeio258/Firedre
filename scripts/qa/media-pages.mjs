// #3 媒体页（bilibili/mal）客户端渲染无头验证（CDP 驱动 Windows Chrome）
import { execFileSync } from "node:child_process";
import {
	check,
	d1,
	launchBrowser,
	startPreview,
	stopPreview,
	summary,
} from "./lib.mjs";

const PORT = 4394;
// preview 用 wrangler 本地 D1：先应用迁移确保表存在
execFileSync(
	"npx",
	["wrangler", "d1", "migrations", "apply", "firedre-blog", "--local"],
	{ stdio: "ignore" },
);
// 本地测试库启用 bilibili/mal 页（生产为关闭；测试需开启才能验证页面）
d1(
	"INSERT INTO site_settings (key,value,updated_at) VALUES ('basic', json('{\"pageBilibili\":true,\"pageMal\":true}'), datetime('now')) ON CONFLICT(key) DO UPDATE SET value=json_patch(value,'{\"pageBilibili\":true,\"pageMal\":true}'), updated_at=datetime('now')",
);
d1(
	"UPDATE site_settings SET value=CAST(value AS INTEGER)+1 WHERE key='__firedre_settings_version'",
);

const { proc, base } = await startPreview(PORT);
try {
	const { browser, page, errors } = await launchBrowser({
		width: 1440,
		height: 900,
	});

	// bilibili：SSR 快 + 客户端经 /api/bilibili/ 拉取（无凭据/网络失败时优雅降级）
	const t0 = Date.now();
	const resp = await page.goto(base + "/bilibili/", {
		waitUntil: "load",
		timeout: 45000,
	});
	const ssrMs = Date.now() - t0;
	check(
		"bilibili 页 200",
		resp?.status() === 200,
		`status=${resp?.status()} ssr=${ssrMs}ms`,
	);
	const html = await page.content();
	check(
		"bilibili SSR 无内联番剧数据",
		!html.includes("season_type") && !html.includes("originalTitle"),
	);
	await page.waitForTimeout(4000);
	// 客户端拉取后：出现网格卡片或降级提示（两者皆可，取决于网络）
	const gridOrFallback = await page.locator(".media-grid, .media-list").count();
	check(
		"bilibili 组件已渲染（网格容器）",
		gridOrFallback > 0,
		`容器×${gridOrFallback}`,
	);

	// mal：本地无凭据 → 未配置提示
	const malResp = await page.goto(base + "/myanimelist/", {
		waitUntil: "load",
		timeout: 45000,
	});
	check(
		"myanimelist 页 200",
		malResp?.status() === 200,
		`status=${malResp?.status()}`,
	);

	// 客户端 API 路径可用性（尾斜杠修正验证）
	const biliApi = await page.request.get(base + "/api/bilibili/", {
		timeout: 20000,
	});
	check(
		"bilibili 代理端点可用",
		biliApi.status() === 200 || biliApi.status() === 500,
		`status=${biliApi.status()}`,
	);
	const setApi = await page.request.get(base + "/api/settings/client/", {
		timeout: 15000,
	});
	check(
		"settings/client 端点可用（settings-live 修复）",
		setApi.status() === 200,
		`status=${setApi.status()}`,
	);

	// 控制台错误（过滤外部资源/网络噪音）
	const real = errors.filter(
		(e) =>
			!e.includes("net::ERR") &&
			!e.includes("Failed to load") &&
			!e.includes("favicon") &&
			!e.includes("404"),
	);
	check("无意外控制台错误", real.length === 0, real.slice(0, 3).join(" | "));

	await browser.close();
} finally {
	stopPreview(proc);
}
summary();

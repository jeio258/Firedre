// 软导航下全局监听器不变式 + 面板交互矩阵
// 用途：防止 SwupScriptsPlugin 重执行容器外脚本导致委托副本累积，
//       进而使 toggle 类面板出现"偶数副本互相抵消"的点击失效。
import {
	startPreview,
	stopPreview,
	launchBrowser,
	check,
	summary,
} from "./lib.mjs";

const base = process.argv[2] || null;
const ownServer = !base;
let server = null;
let baseUrl = base;

if (ownServer) {
	server = await startPreview();
	baseUrl = server.base;
}

// CDP 统计 document 上的 click 监听器数量
async function countClickListeners(cdp) {
	await cdp.send("DOM.getDocument");
	const { result } = await cdp.send("Runtime.evaluate", { expression: "document" });
	const { listeners } = await cdp.send("DOMDebugger.getEventListeners", {
		objectId: result.objectId,
	});
	return listeners.filter((l) => l.type === "click").length;
}

const { browser, page } = await launchBrowser();

try {
	const cdp = await page.context().newCDPSession(page);
	await page.goto(baseUrl + "/", { waitUntil: "load", timeout: 60000 });
	await page.waitForTimeout(3000);

	// 选一个当前视口可见、且受解析期委托管理的面板开关
	const pick = await page.evaluate(() => {
		const map = {
			"display-settings-switch": "display-setting",
			"scheme-switch": "theme-mode-panel",
			"music-player-switch": "music-nav-panel",
		};
		for (const [id, panel] of Object.entries(map)) {
			const el = document.getElementById(id);
			if (el && getComputedStyle(el).display !== "none" && document.getElementById(panel)) {
				return { id, panel };
			}
		}
		return null;
	});
	if (!pick) {
		check("找到可见的面板开关", false, "页面未渲染任何受委托管理的开关");
	} else {
		const baseline = await countClickListeners(cdp);

		const panelOpen = () =>
			page.evaluate(
				(pid) => !document.getElementById(pid)?.classList.contains("float-panel-closed"),
				pick.panel,
			);

		const clickAndAssert = async (label, expected) => {
			await page.click(`#${pick.id}`, { timeout: 8000 }).catch(() => {});
			await page.waitForTimeout(400);
			const open = await panelOpen();
			check(`${label}: 面板 ${expected ? "可打开" : "状态正确"}`, expected ? open === true : true,
				expected ? "" : `open=${open}`);
			if (open) {
				await page.click(`#${pick.id}`, { force: true }).catch(() => {});
				await page.waitForTimeout(250);
			}
		};

		await clickAndAssert("初始加载", true);

		// 单程软导航交替 6 次（奇偶数都覆盖）
		const postHref = await page.evaluate(
			() => document.querySelector('#swup-container a[href^="/posts/"]')?.getAttribute("href") ?? null,
		);
		if (!postHref) {
			check("找到文章链接用于软导航", false, "首页无文章链接，跳过导航矩阵");
		} else {
			let grew = null;
			for (let i = 1; i <= 6; i++) {
				const target = i % 2 === 1 ? `#swup-container a[href="${postHref}"]` : 'a[href="/"]';
				await page.click(target, { timeout: 8000 }).catch(async () => {
					await page.goto(i % 2 === 1 ? baseUrl + postHref : baseUrl + "/", { waitUntil: "load" });
				});
				await page.waitForTimeout(2400);
				const now = await countClickListeners(cdp);
				if (now > baseline && grew === null) grew = { at: i, now };
				await clickAndAssert(`软导航 ${i} 次后`, true);
			}
			check(
				"软导航后 document click 监听器数量不增长",
				grew === null,
				grew ? `第 ${grew.at} 次导航后增至 ${grew.now}（基线 ${baseline}）` : `恒定 ${baseline}`,
			);
		}
	}
} finally {
	await browser.close();
	if (ownServer) stopPreview(server?.proc);
}

process.exit(summary() ? 0 : 1);

// 显示设置面板交互矩阵：采集各 tab 控件清单与开关/重置的状态变化，与基线比对。
// 用途：DisplaySettingsIntegrated 属历史复发区，重构时用它做"行为不变"机器护栏。
// 用法：
//   pnpm qa:panel           对比基线
//   pnpm qa:panel --update  重写基线
// 说明：脚本会临时把 panel 分组设为"全启用"以便渲染所有控件，结束后还原。
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import {
	startPreview,
	stopPreview,
	launchBrowser,
	injectSettingGroup,
	check,
	summary,
} from "./lib.mjs";

const UPDATE = process.argv.includes("--update");
const BASELINE = "scripts/qa/panel-baseline.json";

const PANEL_ALL_ON = JSON.stringify({
	enable: true,
	themeColorSwitchable: true,
	layoutSwitchable: true,
	cardBorderSwitchable: true,
	cardFollowThemeSwitchable: true,
	wallpaperModeSwitchable: true,
	wavesSwitchable: true,
	gradientSwitchable: true,
	bannerTitleSwitchable: true,
	bannerCarouselSwitchable: true,
	sakuraSwitchable: true,
	overlayOpacitySwitchable: true,
	overlayBlurSwitchable: true,
	overlayCardOpacitySwitchable: true,
});

// 必须在启动服务前注入：wrangler 启动期可能已渲染并缓存首页 HTML
const restorePanel = injectSettingGroup("panel", PANEL_ALL_ON);
const server = await startPreview();
const { browser, page, errors } = await launchBrowser();

// 采集当前打开面板的控件清单与状态
async function snapshot(label) {
	return page.evaluate((tabLabel) => {
		const panel = document.getElementById("display-setting");
		if (!panel) return { missing: true };
		const open = !panel.classList.contains("float-panel-closed");
		const tabs = [...panel.querySelectorAll("button")]
			.filter((b) => b.getAttribute("aria-selected") !== null || /^(外观|壁纸|特效)/.test(b.textContent.trim()))
			.map((b) => ({ text: b.textContent.trim().slice(0, 10), active: b.getAttribute("aria-selected") === "true" }));
		// 开关行：含开关滑块的按钮
		const toggles = [...panel.querySelectorAll(".w-full.btn-regular")]
			.filter((b) => b.querySelector("div.w-10.h-5"))
			.map((b) => {
				const on = b.className.includes("bg-(--btn-regular-bg-hover)") || /bg-\(--primary\)/.test(b.querySelector("div.w-10.h-5").className);
				return { label: b.textContent.trim().slice(0, 20), on };
			});
		// 重置按钮：disabled / 可见性
		const resets = [...panel.querySelectorAll('button[aria-label="Reset to Default"]')].map((b) => ({
			disabled: b.disabled === true,
			hidden: b.className.includes("opacity-0"),
		}));
		const sliders = [...panel.querySelectorAll('input[type="range"]')].map((i) => `${i.min}~${i.max}:${i.value}`);
		return { label: tabLabel, open, tabs, toggles, resets, sliders, textLen: panel.innerText.length };
	}, label);
}

const records = [];
const openPanel = async () => {
	const sw = await page.$("#display-settings-switch");
	if (!sw) return false;
	await page.click("#display-settings-switch").catch(() => {});
	await page.waitForTimeout(500);
	return page.evaluate(() => !!document.getElementById("display-setting"));
};
const closePanel = async () => {
	await page.click("#display-settings-switch", { force: true }).catch(() => {});
	await page.waitForTimeout(300);
};

try {
	await page.goto(server.base + "/", { waitUntil: "load", timeout: 60000 });
	await page.waitForTimeout(3000);
	if (!(await openPanel())) {
		check("显示设置面板可用", false, "未渲染 display-settings-switch（检查 panel 注入是否生效）");
	} else {
		check("显示设置面板可用", true);
		const tabCount = await page.evaluate(
			() => document.querySelectorAll("#display-setting button").length,
		);
		records.push(await snapshot("初始"));

		// 遍历每个 tab：采集结构 + 逐个翻转该 tab 上的开关（并复位）
		const tabLabels = await page.evaluate(() =>
			[...document.querySelectorAll("#display-setting button")]
				.map((b) => b.textContent.trim())
				.filter((t) => ["外观", "壁纸", "特效"].includes(t)),
		);
		const allFlips = [];
		for (const t of tabLabels) {
			await page.evaluate((label) => {
				const btn = [...document.querySelectorAll("#display-setting button")].find(
					(b) => b.textContent.trim() === label,
				);
				btn?.click();
			}, t);
			await page.waitForTimeout(700);
			records.push(await snapshot(`tab-${t}`));

			const n = await page.evaluate(
				() =>
					[...document.querySelectorAll("#display-setting .w-full.btn-regular")].filter((b) =>
						b.querySelector("div.w-10.h-5"),
					).length,
			);
			for (let k = 0; k < n; k++) {
				const before = await page.evaluate((idx) => {
					const list = [...document.querySelectorAll("#display-setting .w-full.btn-regular")].filter((b) =>
						b.querySelector("div.w-10.h-5"),
					);
					const b = list[idx];
					if (!b) return null;
					return {
						label: b.textContent.trim().slice(0, 20),
						on: /bg-\(--primary\)/.test(b.querySelector("div.w-10.h-5").className),
					};
				}, k);
				if (!before) continue;
				await page.evaluate((idx) => {
					const list = [...document.querySelectorAll("#display-setting .w-full.btn-regular")].filter((b) =>
						b.querySelector("div.w-10.h-5"),
					);
					list[idx]?.click();
				}, k);
				await page.waitForTimeout(450);
				const after = await page.evaluate((idx) => {
					const list = [...document.querySelectorAll("#display-setting .w-full.btn-regular")].filter((b) =>
						b.querySelector("div.w-10.h-5"),
					);
					const b = list[idx];
					return b ? { on: /bg-\(--primary\)/.test(b.querySelector("div.w-10.h-5").className) } : null;
				}, k);
				allFlips.push({ tab: t, label: before.label, from: before.on, to: after?.on });
				// 复位
				await page.evaluate((idx) => {
					const list = [...document.querySelectorAll("#display-setting .w-full.btn-regular")].filter((b) =>
						b.querySelector("div.w-10.h-5"),
					);
					list[idx]?.click();
				}, k);
				await page.waitForTimeout(350);
			}
		}
		records.push({ label: "开关翻转", flips: allFlips });
		check("面板无控制台错误", errors.length === 0, errors.slice(0, 2).join(" | "));
		await closePanel();
	}

	if (UPDATE || !existsSync(BASELINE)) {
		writeFileSync(BASELINE, JSON.stringify(records, null, 1));
		console.log(`已写入面板基线：${BASELINE}`);
		check("面板基线写入", true);
	} else {
		const base = JSON.parse(readFileSync(BASELINE, "utf8"));
		const now = JSON.stringify(records);
		const same = JSON.stringify(base) === now;
		check("面板结构与交互与基线一致", same);
		if (!same) {
			const b0 = JSON.stringify(base[0]);
			const n0 = JSON.stringify(records[0]);
			console.log("基线(初始):", b0.slice(0, 400));
			console.log("现在(初始):", n0.slice(0, 400));
		}
	}
} finally {
	await browser.close();
	stopPreview(server.proc);
	if (restorePanel) restorePanel();
}

process.exit(summary() ? 0 : 1);

import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { launchBrowser } from "./lib.mjs";

const BASE = "http://localhost:4321";
const dev = spawn("pnpm", ["dev"], {
	cwd: process.cwd(),
	detached: true,
	stdio: "ignore",
});
const ready = async () => {
	for (let i = 0; i < 50; i++) {
		try {
			if ((await fetch(BASE + "/")).status === 200) return true;
		} catch {}
		await delay(2000);
	}
	return false;
};

try {
	if (!(await ready())) throw new Error("dev 未就绪");
	const { browser, page } = await launchBrowser({ width: 1440, height: 900 });
	await page.goto(BASE + "/admin/", { waitUntil: "load", timeout: 45000 });
	await page.waitForTimeout(2500);
	const pwd = page.locator('input[type="password"]');
	if (await pwd.count()) {
		await page.fill(
			'input[type="text"], input[name="username"]',
			"qa_stress_admin",
		);
		await pwd.first().fill("NewPass#2026!y");
		await page.keyboard.press("Enter");
		await page.waitForTimeout(4000);
	}
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
	for (let ci = 0; ci < cats.length; ci++) {
		const cat = page.locator(".s3cat").nth(ci);
		if (!(await cat.count())) continue;
		await cat.click();
		await page.waitForTimeout(1500);
		const groups = await page.locator(".settings-nav .sn").allTextContents();
		console.log(`【${cats[ci]}】组别(${groups.length}):`, groups.join(" | "));
	}
	await browser.close();
} finally {
	try {
		process.kill(-dev.pid, "SIGKILL");
	} catch {
		try {
			dev.kill("SIGKILL");
		} catch {}
	}
}

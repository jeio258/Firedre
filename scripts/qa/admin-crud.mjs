// 后台写入路径 E2E：验证保存/编辑/删除的真实往返（本轮 fetch→apiJson 收敛的回归保障）
import {
	startPreview,
	stopPreview,
	launchBrowser,
	login,
	injectTestAdmin,
	check,
	summary,
	uniqueTag,
} from "./lib.mjs";

const baseArg = process.argv[2] || null;
const server = baseArg ? null : await startPreview();
const base = baseArg || server.base;

const restoreAdmin = injectTestAdmin();
const { browser, page, errors } = await launchBrowser();
page.on("dialog", (d) => d.accept());

const tag = uniqueTag("QA_LINK");
const tagEdited = tag + "_e";

const msgText = () => page.locator(".crud-msg").first().textContent().catch(() => "");
const waitMsg = async (expect) => {
	try {
		await page.waitForFunction(
			(t) => document.querySelector(".crud-msg")?.textContent?.includes(t),
			expect,
			{ timeout: 8000 },
		);
		return true;
	} catch {
		return false;
	}
};

try {
	const ok = await login(page, base);
	check("后台登录成功", ok, ok ? "" : "登录失败（本地管理员密码未匹配）");

	if (ok) {
		// ---------- 友链 CRUD（POST / PUT / DELETE） ----------
		await page.goto(base + "/admin/links/", { waitUntil: "load" });
		await page.waitForTimeout(2500);
		const created = await page.locator(`.crud-row:has-text("${tag}")`).count().catch(() => 0);

		await page.click(".crud-head-actions .btn-primary");
		await page.waitForTimeout(600);
		check("打开新增表单", (await page.locator(".crud-form").count()) === 1);

		await page.fill('input[placeholder="友链名称"]', tag);
		await page.fill('input[placeholder="https://example.com/avatar.png"]', "https://example.com/a.png");
		await page.fill('input[placeholder="https://example.com"]', "https://example.com");
		await page.click(".crud-form-actions .btn-primary");

		const saved = await waitMsg("已保存");
		check("新增友链：提示已保存", saved, saved ? "" : `实际提示 "${(await msgText()) || "(空)"}"`);
		await page.waitForTimeout(1200);
		check("新增友链：列表出现该项", (await page.locator(`.crud-row:has-text("${tag}")`).count()) === 1);

		// 编辑（PUT）
		await page.locator(`.crud-row:has-text("${tag}")`).locator("button:has-text('编辑')").first().click();
		await page.waitForTimeout(700);
		await page.fill('input[placeholder="友链名称"]', tagEdited);
		await page.click(".crud-form-actions .btn-primary");
		const savedEdit = await waitMsg("已保存");
		check("编辑友链（PUT）：提示已保存", savedEdit, savedEdit ? "" : `实际提示 "${(await msgText()) || "(空)"}"`);
		await page.waitForTimeout(1200);
		check("编辑友链：列表标题已更新", (await page.locator(`.crud-row:has-text("${tagEdited}")`).count()) === 1);

		// 删除（DELETE，含 confirm）
		await page.locator(`.crud-row:has-text("${tagEdited}")`).locator("button:has-text('删除')").first().click();
		const deleted = await waitMsg("已删除");
		check("删除友链（DELETE）：提示已删除", deleted, deleted ? "" : `实际提示 "${(await msgText()) || "(空)"}"`);
		await page.waitForTimeout(1200);
		check("删除友链：列表已移除", (await page.locator(`.crud-row:has-text("${tagEdited}")`).count()) === 0);

		// ---------- 设置保存（PUT /api/settings/，走顶栏「保存全部」） ----------
		await page.goto(base + "/admin/settings/", { waitUntil: "load" });
		await page.waitForTimeout(3500);
		const descField = page
			.locator('.a2f:has(label:text-is("站点描述")) textarea, .a2f:has(label:text-is("站点描述")) input')
			.first();
		if ((await descField.count()) > 0) {
			const original = await descField.inputValue();
			await descField.fill(tag + " 设置保存测试");
			await page.waitForTimeout(400);
			const saveAll = page.locator('button:has(.btn-label:text-is("保存全部"))');
			await saveAll.click({ timeout: 10000 });
			const okSave = await page
				.waitForFunction(
					() => /已保存/.test(document.querySelector(".save-msg")?.textContent ?? ""),
					null,
					{ timeout: 15000 },
				)
				.then(() => true)
				.catch(() => false);
			check("设置保存（PUT /api/settings/）：提示已保存", okSave,
				okSave ? "" : `实际 "${(await page.locator(".save-msg").first().textContent().catch(() => "")) || "(空)"}"`);
			await page.waitForTimeout(1500);
			// 还原原值
			await descField.fill(original);
			await page.waitForTimeout(400);
			await saveAll.click({ timeout: 10000 });
			await page.waitForTimeout(2500);
		} else {
			check("设置页站点描述字段存在", false, "未找到字段，跳过设置保存用例");
		}

		check("后台用例无控制台错误", errors.length === 0, errors.slice(0, 2).join(" | "));
	}
} finally {
	await browser.close();
	stopPreview(server?.proc);
	if (restoreAdmin) restoreAdmin();
}

process.exit(summary() ? 0 : 1);

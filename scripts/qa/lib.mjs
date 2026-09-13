import { spawn, execFileSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";

export const QA_ADMIN_USER = process.env.QA_ADMIN_USER || "admin";
export const QA_ADMIN_PASS = process.env.QA_ADMIN_PASS || "localqa2026";
const DEFAULT_PORT = Number(process.env.QA_PORT || 8787);

const results = [];

export function check(name, ok, detail = "") {
	results.push({ name, ok, detail });
	console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  → " + detail : ""}`);
	return ok;
}

export function summary() {
	const failed = results.filter((r) => !r.ok);
	console.log(
		`\n${results.length - failed.length}/${results.length} 通过` +
			(failed.length ? `，失败：\n  - ${failed.map((f) => f.name).join("\n  - ")}` : ""),
	);
	return failed.length === 0;
}

export function uniqueTag(prefix = "QA") {
	return `${prefix}_${Date.now().toString(36)}`;
}

function clearHtmlCache() {
	const dir = ".wrangler/state/v3/cache";
	if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
}

export function d1(sql) {
	return execFileSync(
		"npx",
		["wrangler", "d1", "execute", "firedre-blog", "--local", "--command", sql],
		{ encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
	);
}

export function getAdminPasswordHash() {
	const out = d1("SELECT password_hash FROM admin_users LIMIT 1");
	const m = out.match(/"password_hash":\s*"([^"]+)"/);
	return m ? m[1] : null;
}

export function bcryptHash(plain) {
	return execFileSync(
		"node",
		["-e", 'console.log(require("bcryptjs").hashSync(process.env.QA_PW, 10))'],
		{ encoding: "utf8", env: { ...process.env, QA_PW: plain } },
	).trim();
}

export function setAdminPassword(hash) {
	d1(`UPDATE admin_users SET password_hash='${hash}' WHERE username='${QA_ADMIN_USER}'`);
}

// 读取 site_settings 某个分组的原始 JSON 文本（值本身是 JSON 字符串）
export function readSettingGroup(key) {
	const out = d1(`SELECT value FROM site_settings WHERE key='${key}'`);
	const start = out.indexOf("[");
	const end = out.lastIndexOf("]");
	if (start < 0 || end < 0) return null;
	try {
		const parsed = JSON.parse(out.slice(start, end + 1));
		return parsed?.[0]?.results?.[0]?.value ?? null;
	} catch {
		return null;
	}
}

// 写入分组值并返回还原函数
export function injectSettingGroup(key, jsonValue) {
	const original = readSettingGroup(key);
	const esc = (v) => v.replace(/'/g, "''");
	d1(`UPDATE site_settings SET value='${esc(jsonValue)}' WHERE key='${key}'`);
	return () => {
		if (original === null) return;
		d1(`UPDATE site_settings SET value='${esc(original)}' WHERE key='${key}'`);
	};
}

// 临时把管理员密码换成已知值，返回还原函数
export function injectTestAdmin() {
	const original = getAdminPasswordHash();
	if (!original) {
		console.warn("未找到本地管理员账号，后台用例将跳过（可先在 /admin/setup/ 创建）");
		return null;
	}
	setAdminPassword(bcryptHash(QA_ADMIN_PASS));
	return () => setAdminPassword(original);
}

async function portReady(base) {
	try {
		const res = await fetch(base + "/", { signal: AbortSignal.timeout(3000) });
		return res.status === 200;
	} catch {
		return false;
	}
}

export async function startPreview(port = DEFAULT_PORT) {
	if (!existsSync("dist")) {
		throw new Error("未找到 dist/，请先执行 pnpm build");
	}
	clearHtmlCache();
	const base = `http://localhost:${port}`;
	const proc = spawn(
		"npx",
		["wrangler", "pages", "dev", "dist", "--port", String(port)],
		{ detached: true, stdio: ["ignore", "pipe", "pipe"] },
	);
	proc.stdout.on("data", () => {});
	proc.stderr.on("data", () => {});

	const deadline = Date.now() + 90000;
	while (Date.now() < deadline) {
		if (await portReady(base)) return { proc, base };
		await delay(2000);
	}
	stopPreview(proc);
	throw new Error(`预览服务启动超时（端口 ${port}）`);
}

export function stopPreview(proc) {
	if (!proc || proc.killed) return;
	try {
		process.kill(-proc.pid, "SIGKILL");
	} catch {
		try {
			proc.kill("SIGKILL");
		} catch {}
	}
	try {
		execFileSync("pkill", ["-9", "-x", "workerd"], { stdio: "ignore" });
	} catch {}
}

export async function launchBrowser(viewport = { width: 1440, height: 900 }, opts = {}) {
	const { chromium } = await import("playwright");
	const browser = await chromium.launch();
	const ctx = await browser.newContext({ viewport, ...opts });
	const page = await ctx.newPage();
	const errors = [];
	page.on("console", (m) => {
		if (m.type() === "error") errors.push(m.text().slice(0, 160));
	});
	page.on("pageerror", (e) => errors.push("pageerror: " + String(e).slice(0, 160)));
	return { browser, ctx, page, errors };
}

export async function login(page, base) {
	await page.goto(base + "/admin/", { waitUntil: "load", timeout: 60000 });
	await page.waitForTimeout(2500);
	const pwd = page.locator('input[type="password"]');
	if ((await pwd.count()) > 0) {
		await page.fill('input[type="text"], input[name="username"]', QA_ADMIN_USER);
		await pwd.first().fill(QA_ADMIN_PASS);
		await page.keyboard.press("Enter");
		await page.waitForTimeout(4000);
	}
	return !(await pwd.count());
}

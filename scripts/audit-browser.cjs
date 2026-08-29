/** Firedre 全站快速审查（Playwright APIRequestContext，稳定可靠） */
const { request, chromium } = require("playwright");
const BASE = process.env.SITE_URL || "https://firedre.pages.dev";
const PAGES = ["/", "/posts/", "/search/", "/about/", "/gallery/", "/links/", "/spec/about/", "/spec/guestbook/", "/admin/"];
const APIS = ["/api/posts/", "/api/allPostMeta.json", "/api/posts/taxonomy/tags/", "/api/posts/taxonomy/archives/", "/api/posts/taxonomy/categories/", "/api/notice/", "/api/settings/"];

(async () => {
	const apiCtx = await request.newContext({ baseURL: BASE, maxRedirects: 5 });
	let pass = 0, fail = 0;
	const ok = (n, c, x = "") => { c ? pass++ : fail++; console.log(`${c ? "✅" : "❌"} ${n}${x ? " - " + x : ""}`); };

	for (const path of PAGES) {
		const t0 = Date.now();
		try {
			const resp = await apiCtx.get(path, { timeout: 40000 });
			const status = resp.status();
			const body = await resp.text();
			const is404 = path === "/posts/";
			const html = status === 200 || (is404 && status === 404);
			const hasContent = body.length > 200;
			ok(`${path}`, html && hasContent, `status=${status} ${body.length}b in ${Date.now() - t0}ms`);
		} catch (e) {
			ok(`${path}`, false, `${e.message.split("\n")[0]} in ${Date.now() - t0}ms`);
		}
	}

	for (const ep of APIS) {
		try {
			const resp = await apiCtx.get(ep, { timeout: 30000 });
			let json = null;
			try { json = await resp.json(); } catch {}
			const summary = Array.isArray(json) ? `${json.length} items` : (json && typeof json === "object" ? "object" : "non-json");
			ok(`API ${ep}`, json !== null && resp.status() === 200, `status=${resp.status()} ${summary}`);
		} catch (e) { ok(`API ${ep}`, false, e.message.split("\n")[0]); }
	}

	await apiCtx.dispose();
	console.log(`\n=== ${pass}/${pass + fail} checks passed ===`);
	process.exit(fail ? 1 : 0);
})();

import { chromium } from "playwright";
import fs from "node:fs";
const exe = "/home/lyxy/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome";
const base = "https://firedre.994613.xyz";
const outDir = "/tmp/baseline-after";
fs.mkdirSync(outDir, { recursive: true });
const TOKEN = process.env.TOKEN;
const routes = ["/", "/posts/firedre/", "/gallery/", "/about/", "/login/", "/register/"];
const views = [{ n: "pc", w: 1440, h: 900 }, { n: "m", w: 390, h: 844 }];
const sig = {};
const b = await chromium.launch({ headless: true, executablePath: exe });
for (const v of views) {
  for (const theme of ["light", "dark"]) {
    const ctx = await b.newContext({ viewport: { width: v.w, height: v.h }, colorScheme: theme === "dark" ? "dark" : "light" });
    if (TOKEN) await ctx.addCookies([{ name: "user_session", value: TOKEN, domain: "firedre.994613.xyz", path: "/", httpOnly: true, secure: true, sameSite: "Lax" }]);
    const p = await ctx.newPage();
    p.setDefaultTimeout(50000);
    for (const r of routes.concat(TOKEN ? ["/admin/", "/admin/posts/new/"] : [])) {
      await p.goto(base + r, { waitUntil: "domcontentloaded" });
      await p.evaluate(t => localStorage.setItem("theme", t), theme);
      await p.reload({ waitUntil: "domcontentloaded" });
      await p.waitForTimeout(2200);
      const name = `${v.n}-${theme}-${r.replace(/\//g, "_") || "home"}`;
      await p.screenshot({ path: `${outDir}/${name}.png`, fullPage: true });
      sig[name] = await p.evaluate(() => {
        const sels = ["body", "h1", "h2", "p", "a", "header", "footer", "form", ".card-base", ".sidebar", ".shell", ".auth-standalone__card", ".EasyMDEContainer"];
        const out = {};
        for (const s of sels) {
          const el = document.querySelector(s);
          if (!el) continue;
          const c = getComputedStyle(el);
          const rr = el.getBoundingClientRect();
          out[s] = [c.color, c.backgroundColor, c.fontSize, c.fontFamily.slice(0, 30), c.lineHeight, Math.round(rr.x), Math.round(rr.y), Math.round(rr.width), Math.round(rr.height)].join("|");
        }
        return out;
      });
    }
    await ctx.close();
  }
}
fs.writeFileSync(`${outDir}/signature.json`, JSON.stringify(sig, null, 1));
console.log("改后快照完成:", Object.keys(sig).length, "页");
await b.close();

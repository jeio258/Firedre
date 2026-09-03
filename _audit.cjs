const { chromium } = require('playwright');
(async () => {
  const base = 'http://127.0.0.1:4321';
  const browser = await chromium.launch({ headless: true });
  const routes = [
    ['/admin/dashboard/', 'dashboard'],
    ['/admin/posts/', 'posts'],
    ['/admin/posts/new/', 'posts-new'],
    ['/admin/links/', 'links'],
    ['/admin/sitelinks/', 'sitelinks'],
    ['/admin/notice/', 'notice'],
    ['/admin/dynamics/', 'dynamics'],
    ['/admin/about/', 'about'],
    ['/admin/gallery/', 'gallery'],
    ['/admin/gallery/new/', 'gallery-new'],
    ['/admin/settings/', 'settings'],
  ];
  const report = [];
  for (const [path, name] of routes) {
    for (const theme of ['light', 'dark']) {
      for (const vw of [{ w: 1440, h: 1000 }, { w: 390, h: 844 }]) {
        const ctx = await browser.newContext({ viewport: { width: vw.w, height: vw.h }, isMobile: vw.w < 500, hasTouch: vw.w < 500 });
        await ctx.request.post(base + '/api/admin/login/', { data: { username: 'admin', password: '12345678' } });
        const p = await ctx.newPage();
        const errs = [];
        p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 120)); });
        p.on('pageerror', e => errs.push('PAGEERR ' + e.message.slice(0, 120)));
        const r = await p.goto(base + path, { waitUntil: 'domcontentloaded', timeout: 40000 }).catch(() => null);
        await p.waitForTimeout(theme === 'dark' ? 2200 : 1800);
        if (theme === 'dark') {
          await p.evaluate(() => localStorage.setItem('theme', 'dark'));
          await p.reload({ waitUntil: 'domcontentloaded', timeout: 40000 });
          await p.waitForTimeout(2200);
        }
        const audit = await p.evaluate(() => {
          const issues = [];
          const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
          if (overflow > 4) issues.push('H-overflow ' + Math.round(overflow) + 'px');
          // 可视区内的卡片内容截断(label 被 ellipsis/裁剪)
          document.querySelectorAll('.toggle-label').forEach((el) => {
            if (el.scrollWidth > el.clientWidth + 2) issues.push('trunc-label "' + el.textContent.trim().slice(0, 8) + '"');
          });
          // 被裁剪/重叠检测
          return issues;
        });
        const shot = '/tmp/admin-audit/' + name + '-' + theme + '-' + vw.w + '.png';
        await p.screenshot({ path: shot });
        report.push({ page: name, theme, vw: vw.w, issues: [...audit, ...errs] });
        await ctx.close();
      }
    }
  }
  console.log(JSON.stringify(report, null, 1));
  await browser.close();
})();

const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto('http://localhost:4321/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  const r = await page.evaluate(() => {
    const c = document.querySelector('.profile-card');
    if (!c) return { err: 'no profile-card' };
    const socialRow = c.querySelector('.flex.flex-wrap.gap-2.justify-center');
    return {
      profileCards: document.querySelectorAll('.profile-card').length,
      socialChildren: socialRow ? socialRow.children.length : -1,
      socialLabels: socialRow ? Array.from(socialRow.querySelectorAll('a[aria-label]')).map(a => a.getAttribute('aria-label')) : [],
    };
  });
  console.log(JSON.stringify(r, null, 1));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });

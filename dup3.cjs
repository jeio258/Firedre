const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto('https://firedre.994613.xyz/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  const r = await page.evaluate(() => {
    const c = document.querySelector('.profile-card');
    const socialRow = c.querySelector('.flex.flex-wrap.gap-2.justify-center');
    return {
      socialRowHTML: socialRow ? socialRow.outerHTML.slice(0, 600) : 'NO_ROW',
      socialRowChildren: socialRow ? socialRow.children.length : 0,
      allProfileChildren: Array.from(c.querySelectorAll('a, div, button')).slice(0, 5).map(e => e.tagName + ':' + e.className.slice(0, 40)),
    };
  });
  console.log('社交行子元素数:', r.socialRowChildren);
  console.log('社交行HTML前600:', r.socialRowHTML);
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });

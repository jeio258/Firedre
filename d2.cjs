const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  await p.goto('http://localhost:4321/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  const h = await p.evaluate(() => document.querySelector('.profile-card .flex.flex-wrap.gap-2')?.outerHTML);
  console.log(h);
  await b.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });

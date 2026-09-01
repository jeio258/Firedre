const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto('https://firedre.994613.xyz/', { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(1200);
  // 资料卡滚动到视口
  const card = page.locator('.profile-card').first();
  await card.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/tmp/profile_mobile.png' });
  // 输出资料卡尺寸与样式
  const info = await page.evaluate(() => {
    const c = document.querySelector('.profile-card');
    if (!c) return null;
    const r = c.getBoundingClientRect();
    const cs = getComputedStyle(c);
    const avatar = c.querySelector('img');
    const ar = avatar ? avatar.getBoundingClientRect() : null;
    return { cardW: Math.round(r.width), cardH: Math.round(r.height), cardMargin: cs.margin, avatarW: ar ? Math.round(ar.width) : null, avatarH: ar ? Math.round(ar.height) : null };
  });
  console.log('资料卡信息:', JSON.stringify(info));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });

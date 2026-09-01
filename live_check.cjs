const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  for (const w of [390, 1280]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 800 } });
    const page = await ctx.newPage();
    await page.goto('https://firedre.994613.xyz/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    const r = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.profile-card'));
      const mobileBottomProfile = document.getElementById('bottom-sidebar')
        ? document.getElementById('bottom-sidebar').querySelectorAll('.profile-card').length
        : -1;
      return { profileCards: cards.length, visible: cards.filter(c => c.getClientRects().length > 0).length, mobileBottomProfile };
    });
    console.log(w + 'px: ' + JSON.stringify(r));
    await ctx.close();
  }
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });

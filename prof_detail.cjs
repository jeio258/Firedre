const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto('https://firedre.994613.xyz/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  const r = await page.evaluate(() => {
    const c = document.querySelector('.profile-card');
    if (!c) return null;
    const nameEls = Array.from(c.querySelectorAll('*')).filter(e => e.children.length === 0 && e.textContent.trim().length > 0).map(e => e.textContent.trim()).filter(t => t.length < 20);
    const social = Array.from(c.querySelectorAll('a[rel="me"], a[aria-label]')).filter(a => a.getAttribute('aria-label')).map(a => a.getAttribute('aria-label'));
    const avatar = c.querySelector('img');
    return { allTextNodes: nameEls, socialLinks: social, avatarSrc: avatar ? (avatar.currentSrc || avatar.src).split('?')[0].slice(-40) : null };
  });
  console.log('资料卡内容:', JSON.stringify(r, null, 1));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });

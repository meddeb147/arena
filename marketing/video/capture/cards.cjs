// Screenshots every game card from the real landing page (live previews and
// "coming soon" art), for the "universe" scene and the orbiting icons.
// usage: node capture/cards.cjs [url]
const { chromium } = require('playwright');
const fs = require('node:fs');

const url = process.argv[2] || 'http://localhost:8090/?server=offline';

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
  await p.goto(url);
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(2500);
  fs.mkdirSync('public/cards', { recursive: true });
  const cards = await p.$$('.l-card');
  for (const c of cards) {
    const id = await c.$eval('canvas', (el) => el.dataset.game);
    await c.scrollIntoViewIfNeeded();
    await p.waitForTimeout(600);
    await c.screenshot({ path: `public/cards/${id}.png` });
    const media = await c.$('.l-card-media');
    await media.screenshot({ path: `public/cards/${id}-art.png` });
    console.log('card', id);
  }
  await b.close();
})();

// 2026-11-25 screen-change cost (Plain Node script, Playwright). A catalog render stalled phones 0.5–1.2 s because
// 1) flip.js read clientWidth per card right after writing styles (forced layout per card), and
// 2) every mini card was a container-query container (style and layout interleaved per card).
// Mini cards bound by flip.js are now sized from their ResizeObserver (--fx-unit → --mcu) and are not containers;
// calendar-size cards get .mc-tiny. This checks the structure and the result, not timings.
const assert = require('node:assert/strict'), path = require('node:path'), os = require('node:os');
const { pathToFileURL } = require('node:url');
const { executablePath } = require('./browser-runtime.cjs');
const { chromium } = require(process.env.CARDEX_PLAYWRIGHT || path.join(os.tmpdir(), 'aibootcamp-frontend-review/node_modules/playwright'));
const URL = process.env.CARDEX_TEST_URL || pathToFileURL(path.resolve(__dirname, '../index.html')).href;

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath });
  try {
    for (const [width, height] of [[1440, 900], [390, 844]]) {
      const mobile = width < 960, tag = `${width}x${height}`;
      const context = await browser.newContext({ viewport: { width, height }, hasTouch: mobile, isMobile: mobile });
      const page = await context.newPage();
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.goto(URL);
      await page.waitForFunction(() => DiaryReview.isReady());
      await page.locator('header .avatar').click();
      await page.locator('#settings-records [data-action=preview]').click();
      await page.locator('#celebrate-dialog[open]').waitFor({ timeout: 3000 }).catch(() => {});
      await page.keyboard.press('Escape');

      const audit = () => page.evaluate(() => [...document.querySelectorAll('.mini-card')].filter(el => el.offsetParent).map(el => {
        const w = el.getBoundingClientRect().width, band = el.querySelector('.mc-band strong, .mc-band small');
        return {
          w, bound: el.classList.contains('card-fx'), container: getComputedStyle(el).containerType, tiny: el.classList.contains('mc-tiny'),
          unit: parseFloat(getComputedStyle(el).getPropertyValue('--fx-unit')),
          bandShown: band ? getComputedStyle(band).display !== 'none' : null,
          head: parseFloat(getComputedStyle(el.querySelector('.mc-head')).paddingTop),
        };
      }));
      const check = async where => {
        await page.waitForTimeout(300);
        const cards = await audit();
        assert.ok(cards.length > 0, `${tag} ${where}: mini cards present`);
        for (const c of cards.filter(c => c.bound)) {
          assert.equal(c.container, 'normal', `${tag} ${where}: bound mini cards are not query containers`);
          assert.ok(Math.abs(c.unit - c.w / 100) < 0.02, `${tag} ${where}: --fx-unit is 1% of the width (${c.unit} vs ${c.w})`);
          assert.equal(c.tiny, c.w <= 90, `${tag} ${where}: .mc-tiny only at ≤ 90px (${c.w})`);
          if (c.bandShown !== null) assert.equal(c.bandShown, c.w > 90, `${tag} ${where}: band text hidden only on tiny cards`);
          const ratio = c.tiny ? 0.07 : 0.08;
          assert.ok(Math.abs(c.head - c.w * ratio) < 0.6, `${tag} ${where}: head padding scales with the card (${c.head} vs ${c.w * ratio})`);
        }
        return cards;
      };
      await page.locator('.tabs [data-action=write]').first().click();
      const rail = await check('week rail');
      assert.ok(rail.some(c => c.bound && c.tiny), `${tag}: rail cards are tiny`);
      await page.locator('[data-write-calendar=month]').click();
      await check('month cards');
      await page.locator('.tabs [data-action=catalog]').first().click();
      const grid = await check('catalog');
      assert.ok(grid.filter(c => c.bound && !c.tiny).length >= 6, `${tag}: catalog cards are bound full-size cards`);
      // Resizing the window re-sizes the cards through the same observer.
      if (!mobile) {
        await page.setViewportSize({ width: 1180, height: 820 });
        await check('catalog after resize');
      }
      assert.deepEqual(errors, [], `${tag}: no page errors`);
      await context.close();
      console.log(`ok ${tag}`);
    }
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exit(1); });

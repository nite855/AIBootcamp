const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const { reveal } = require('./browser-runtime.cjs');

module.exports = async function modalFoil(browser) {
  for (const width of [1440, 390, 320]) {
    const mobile = width < 960;
    const context = await browser.newContext({ viewport: { width, height: 900 }, hasTouch: mobile, isMobile: mobile });
    try {
      const page = await context.newPage(), errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(process.env.CARDEX_TEST_URL || pathToFileURL(path.resolve(__dirname, '../index.html')).href);
      await page.waitForFunction(() => DiaryReview.isReady());
      await page.locator('#diary-text').fill('Modal foil pending regression');
      await reveal(page, 'save');
      await page.locator('[data-card-day]:visible:has(.mini-card.is-locked)').first().click();
      assert.equal(await page.locator('#card-modal .cm-tilt.card-fx').count(), 1, 'pending card also has neutral foil');
      assert.equal(await page.locator('#card-modal .cm-foil').isVisible(), true, 'hint visible on every viewport');
      await page.keyboard.press('Escape');
      await reveal(page, 'settings'); await reveal(page, 'preview'); await reveal(page, 'write');
      const day = page.locator('[data-card-day]:visible:has(.mini-card:not(.is-locked))').first();
      await day.click();
      const modal = page.locator('#card-modal[open]');
      await modal.waitFor();
      assert.ok((await modal.locator('#card-modal-title').innerText()).includes((await modal.locator('.art-card').getAttribute('aria-label')).replace(' 감정 카드', '')), 'modal art matches record title');
      const client = mobile ? await context.newCDPSession(page) : null;
      const themes = await page.evaluate(() => CardexTheme.themes.map(t => t.id));
      for (const theme of themes) {
        await page.evaluate(id => CardexTheme.setTheme(id), theme);
        assert.ok((await modal.locator('#card-modal-title').innerText()).includes((await modal.locator('.art-card').getAttribute('aria-label')).replace(' 감정 카드', '')), 'theme preserves the modal record');
        const art = modal.locator('.cm-art'), tilt = art.locator('.cm-tilt');
        const box = await art.boundingBox();
        const x = box.x + box.width * .7, y = box.y + box.height * .3;
        if (mobile) await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
        else { await page.mouse.move(0, 0); await page.mouse.move(x, y); }
        await page.waitForFunction(() => document.querySelector('.cm-tilt')?.style.getPropertyValue('--shine') === '1');
        await page.waitForTimeout(240);
        const before = await tilt.evaluate(el => ({ transform: getComputedStyle(el).transform, light: getComputedStyle(el.querySelector('.cm-light')).opacity, x: el.style.getPropertyValue('--light-x') }));
        assert.notEqual(before.transform, 'matrix(1, 0, 0, 1, 0, 0)');
        assert.notEqual(before.transform, 'none'); assert.equal(before.light, '1');
        if (mobile) await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - 30, y: y + 15 }] });
        else await page.mouse.move(x - 30, y + 15);
        await page.waitForFunction(value => document.querySelector('.cm-tilt').style.getPropertyValue('--light-x') !== value, before.x);
        if (mobile) await client.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
        else await page.mouse.move(0, 0);
        await page.waitForFunction(() => document.querySelector('.cm-tilt').style.getPropertyValue('--shine') === '0');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        assert.ok(box.x >= 0 && box.x + box.width <= width);
      }
      await page.screenshot({ path: path.join(require('node:os').tmpdir(), `modal-foil-${width}.png`) });
      // Replacement and close must reset the detached surface too.
      const oldTilt = await modal.locator('.cm-tilt').elementHandle();
      const previous = modal.locator('[data-modal-step="-1"]');
      if (!await previous.isDisabled()) {
        await previous.click();
        assert.equal(await oldTilt.evaluate(el => el.style.getPropertyValue('--shine')), '0');
      }
      await page.keyboard.press('Escape');
      await day.click();
      await modal.waitFor();
      await page.waitForFunction(() => getComputedStyle(document.querySelector('#card-modal .cm-light')).opacity === '0');
      await modal.locator('[data-modal="close"]').click();
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
};

if (require.main === module) {
  const { chromium } = require(process.env.CARDEX_PLAYWRIGHT || path.join(require('node:os').tmpdir(), 'aibootcamp-frontend-review/node_modules/playwright'));
  (async () => {
    const browser = await chromium.launch({ headless: true, executablePath: require('./browser-runtime.cjs').executablePath });
    try { await module.exports(browser); console.log('PASS: modal foil, 10 themes, desktop/touch, cancel, replace, reopen'); }
    finally { await browser.close(); }
  })().catch(e => { console.error(e); process.exitCode = 1; });
}

const assert = require('node:assert/strict');
const path = require('node:path'), os = require('node:os');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.CARDEX_PLAYWRIGHT || path.join(os.tmpdir(), 'aibootcamp-frontend-review/node_modules/playwright'));
const { executablePath, reveal } = require('./browser-runtime.cjs');
const snapshot = el => {
  const rim = el.querySelector('.card-fx-rim'), css = getComputedStyle(rim);
  const before = getComputedStyle(rim, '::before'), after = getComputedStyle(rim, '::after');
  return { grade: el.dataset.grade, emotion: el.dataset.emotion, color: getComputedStyle(el).getPropertyValue('--grade').trim(),
    anim: css.animationName, duration: css.animationDuration, inner: before.borderTopStyle, outline: before.outlineStyle,
    holo: before.animationName, orbit: after.animationName, orbitDuration: after.animationDuration,
    layers: (css.backgroundImage.match(/gradient\(/g) || []).length, rimBorder: css.borderTopStyle,
    transition: getComputedStyle(el).transitionDuration, foilTransition: getComputedStyle(el.querySelector('.card-fx-light')).transitionDuration };
};
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath });
  try {
    for (const width of [320, 390, 768, 959, 960, 1440]) {
      const mobile = width < 960;
      const context = await browser.newContext({ viewport: { width, height: 1000 }, hasTouch: mobile, isMobile: mobile });
      try {
        const page = await context.newPage(), errors = [];
        page.on('pageerror', e => errors.push(e.message));
        await page.goto(process.env.CARDEX_TEST_URL || pathToFileURL(path.resolve(__dirname, '../index.html')).href);
        await page.waitForFunction(() => DiaryReview.isReady());
        await reveal(page, 'settings'); await reveal(page, 'preview');
        const themes = await page.evaluate(() => CardexTheme.themes.map(t => t.id));
        for (const theme of themes) {
          await page.evaluate(id => CardexTheme.setTheme(id), theme);
          await reveal(page, 'review-month');
          const statsCard = page.locator('.top-card .mini-card');
          await statsCard.waitFor({ state: 'attached' });
          await page.waitForFunction(() => document.querySelector('.top-card .card-fx-rim'));
          const type = await statsCard.getAttribute('data-type'), stage = await statsCard.getAttribute('data-stage');
          const stats = await statsCard.evaluate(snapshot);
          await reveal(page, 'catalog');
          const card = page.locator(`.slot .mini-card[data-type="${type}"][data-stage="${stage}"]`);
          assert.deepEqual(await card.evaluate(snapshot), stats, `${width}/${theme}: catalog and statistics share grade effects`);
          assert.equal(stats.transition, '0.18s'); assert.equal(stats.foilTransition, '0.2s');
          assert.equal(await page.locator('.slot .card-fx-rim .card-fx-rim').count(), 0);
          assert.equal(await page.locator('.catalog-head .card-effect-hint').isVisible(), true);
          const hint = await page.locator('.catalog-head .card-effect-hint').boundingBox();
          assert.ok(hint.x >= 0 && hint.x + hint.width <= width + 1, 'hint stays inside mobile viewport');
          for (const stage of [1, 2, 3]) {
            const graded = page.locator(`.slot .mini-card[data-grade="stage-${stage}"]`).first();
            if (!await graded.count()) continue;
            const effect = await graded.evaluate(snapshot);
            // 2026-11-24 ladder: stage 1 breathes, stage 2 runs lights on a metal frame, stage 3 spins the holo ring.
            assert.equal(effect.anim, stage === 1 ? 'card-fx-breathe' : 'none');
            assert.equal(effect.holo, stage === 3 ? 'grade-holo-spin' : 'none');
            assert.equal(effect.orbit, stage === 2 ? 'grade-orbit' : 'none');
            assert.equal(effect.layers, [1, 8, 15][stage - 1], `stage ${stage}: gloss / brackets / brackets + sparkles`);
          }
        }
        const locked = page.locator('.slot.is-locked .mini-card').first();
        if (await locked.count()) assert.equal(await locked.getAttribute('data-grade'), 'pending');
        const target = page.locator('.slot:not(.is-locked) .mini-card').first();
        await target.scrollIntoViewIfNeeded();
        const rect = await target.boundingBox();
        const point = { x: rect.x + rect.width * .7, y: rect.y + rect.height * .3 };
        const client = mobile ? await context.newCDPSession(page) : null;
        if (mobile) await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
        else await page.mouse.move(point.x, point.y);
        await page.waitForFunction(() => document.querySelector('.slot:not(.is-locked) .mini-card').style.getPropertyValue('--shine') === '1');
        if (mobile) {
          await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: point.x - 20, y: point.y }] });
          await page.waitForTimeout(40);
          await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
          assert.equal(await page.locator('#card-detail[open]').count(), 0, 'drag never opens the card');
          await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
          for (const delta of [10, 30, 60]) {
            await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: point.x, y: point.y - delta }] });
            await page.waitForTimeout(30);
          }
          await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
          await page.waitForFunction(() => document.querySelector('.slot:not(.is-locked) .mini-card').style.getPropertyValue('--shine') === '0');
          assert.equal(await page.locator('#card-detail[open]').count(), 0, 'vertical scroll cancels the effect without opening');
        } else await page.mouse.move(0, 0);
        await page.setViewportSize({ width: width + 1, height: 700 });
        await page.waitForFunction(() => document.querySelector('.slot:not(.is-locked) .mini-card').style.getPropertyValue('--shine') === '0');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        await page.screenshot({ path: path.join(os.tmpdir(), `all-card-effects-${width}.png`) });
        assert.deepEqual(errors, []);
      } finally { await context.close(); }
    }
    console.log('PASS: shared catalog/stats grades, 10 themes, six widths, touch drag, resize, hints, no duplicate layers');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });

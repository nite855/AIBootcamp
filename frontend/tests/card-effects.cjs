const {reveal}=require('./browser-runtime.cjs');
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.CARDEX_PLAYWRIGHT || path.join(os.tmpdir(), 'aibootcamp-frontend-review/node_modules/playwright'));

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: require('./browser-runtime.cjs').executablePath });
  try {
    const errors = [];
    let baseline;
    for (const mobile of [false, true]) {
      const context = await browser.newContext({ offline: !process.env.CARDEX_TEST_URL, hasTouch: mobile, isMobile: mobile,
        viewport: mobile ? { width: 375, height: 667 } : { width: 1366, height: 768 } });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(process.env.CARDEX_TEST_URL || pathToFileURL(path.resolve(__dirname, '../index.html')).href);
      await page.waitForFunction(() => DiaryReview.isReady());
      await reveal(page,'settings');
      await reveal(page,'preview');
      await page.locator('[data-open=sample-1]').click();
      const ids = await page.evaluate(() => CardexTheme.themes.map(t => t.id));
      const client = mobile ? await context.newCDPSession(page) : null;
      for (const id of ids) for (const mode of ['light', 'dark']) for (const reducedMotion of ['no-preference', 'reduce']) {
        await page.emulateMedia({ reducedMotion });
        await page.evaluate(({ id, mode }) => { CardexTheme.setTheme(id); CardexTheme.set(mode); CardexTheme.setMotion('on'); }, { id, mode });
        const scene = page.locator('.flip-scene'), front = page.locator('.flip-trigger');
        const styles = await scene.evaluate(el => {
          // Compare gradients at the same light position after each theme switch.
          const tilt = el.querySelector('.tilt-layer');
          tilt.style.setProperty('--light-x', '70%');
          tilt.style.setProperty('--light-y', '30%');
          tilt.style.setProperty('--rear-light-x', '30%');
          const read = (selector, keys) => {
            const css = getComputedStyle(selector ? el.querySelector(selector) : el);
            return keys.map(key => css[key]);
          };
          return { art: read('.art-card', ['borderRadius', 'filter']), rear: read('.flip-back', ['borderRadius', 'boxShadow']),
            perspective: read(null, ['perspective']), flip: read('.flip-inner', ['transitionDuration']),
            tilt: read('.tilt-layer', ['transitionDuration']), light: read('.flip-light', ['borderRadius', 'transitionDuration', 'backgroundImage', 'mixBlendMode']) };
        });
        if (!baseline) baseline = styles;
        assert.deepEqual(styles, baseline, `${id}/${mode}: common effects`);
        assert.equal(styles.art[0], '14px'); assert.notEqual(styles.art[1], 'none');
        assert.equal(styles.rear[0], '14px'); assert.notEqual(styles.rear[1], 'none');
        assert.deepEqual(styles.perspective, ['1200px']); assert.deepEqual(styles.flip, ['0.6s']);
        assert.deepEqual(styles.tilt, ['0.18s']); assert.equal(styles.light[1], '0.2s');
        const boxes = await page.locator('.flip-scene').evaluate(el => ['.art-card','.flip-front .flip-light','.flip-back'].map(s => { const r=el.querySelector(s).getBoundingClientRect(); return [r.x,r.y,r.width,r.height]; }));
        for (const other of boxes.slice(1)) boxes[0].forEach((v,i)=>assert.ok(Math.abs(v-other[i])<=1, `${id}/${mode}: card/light/rear geometry`));
        assert.ok(Math.abs(boxes[0][2]/boxes[0][3]-2/3)<.01);
        for (const action of ['read-full','favorite','download']) assert.equal(await page.locator(`[data-action=${action}]`).count(),1);
        const box = await front.boundingBox();
        const point = { x: box.x + box.width * .7, y: box.y + box.height * .3 };
        if (mobile) {
          await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
          // No long-press delay: light is visible on the next animation frame.
        } else await page.mouse.move(point.x, point.y);
        await page.waitForFunction(() => document.querySelector('.tilt-layer').style.getPropertyValue('--shine') === '1', null, { timeout: 400 });
        const angles = await page.locator('.tilt-layer').evaluate(el => ['--tilt-x', '--tilt-y'].map(k => parseFloat(el.style.getPropertyValue(k))));
        assert.ok(angles.every(n => n > 0 && n <= 9));
        if (mobile) {
          const moved = { x: box.x + box.width * .3, y: box.y + box.height * .7 };
          await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [moved] });
          await page.waitForFunction(() => parseFloat(document.querySelector('.tilt-layer').style.getPropertyValue('--tilt-y')) < 0);
          // Give the browser a rendered drag frame before releasing the contact.
          await page.waitForTimeout(80);
          await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        }
        else await page.mouse.move(0, 0);
        await page.waitForFunction(() => document.querySelector('.tilt-layer').style.getPropertyValue('--shine') === '0');
        assert.equal(await scene.evaluate(el => el.classList.contains('flipped')), false);
        if (mobile) await front.tap();
        else { await front.focus(); await page.keyboard.press('Enter'); }
        await page.waitForFunction(() => document.querySelector('.flip-scene').classList.contains('flipped'));
        assert.equal(await scene.evaluate(el => el.classList.contains('flipped')), true, `${mobile ? 'mobile' : 'desktop'}/${id}/${mode}: tap flips after drag`);
        await page.waitForTimeout(650);
        await page.locator('.flip-back').focus(); await page.keyboard.press('Space');
        assert.equal(await scene.evaluate(el => el.classList.contains('flipped')), false);
        await page.evaluate(() => CardexTheme.setMotion('off'));
        assert.equal(await page.locator('.flip-light').first().evaluate(el => getComputedStyle(el).display), 'none');
        assert.equal(await page.locator('.tilt-layer').evaluate(el => getComputedStyle(el).transform), 'none');
        assert.equal(await page.locator('.flip-inner').evaluate(el => getComputedStyle(el).transitionDuration), '0s');
        await front.focus(); await page.keyboard.press('Space');
        await page.waitForFunction(() => document.querySelector('.flip-scene').classList.contains('flipped'));
        assert.equal(await scene.evaluate(el => el.classList.contains('flipped')), true, `${mobile ? 'mobile' : 'desktop'}/${id}/${mode}: tap flips after drag`);
        await page.locator('.flip-back').focus(); await page.keyboard.press('Enter');
        assert.equal(await scene.evaluate(el => el.classList.contains('flipped')), false);
        for (const width of mobile ? [320, 375] : [1366]) {
          await page.setViewportSize({ width, height: mobile ? 667 : 768 });
          await page.waitForFunction(() => parseInt(document.documentElement.style.getPropertyValue('--app-height')) === innerHeight);
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
          const bounds = await front.locator('.art-card').boundingBox();
          assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width);
        }
        if (id === 'lemon') await page.screenshot({ path: path.join(os.tmpdir(), `card-effects-${mobile ? 'mobile' : 'desktop'}-${mode}.png`) });
      }
      await context.close();
    }
    // Single toggle, old storage migration, explicit settings override OS motion preferences.
    {
      const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1366, height: 768 } });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(process.env.CARDEX_TEST_URL || pathToFileURL(path.resolve(__dirname, '../index.html')).href);
      await page.waitForFunction(() => DiaryReview.isReady());
      assert.equal(await page.evaluate(() => CardexTheme.getMotion()), 'on');
      await reveal(page,'settings');
      const toggle = page.locator('[data-card-motion-toggle]');
      assert.equal(await toggle.count(), 1);
      assert.equal(await page.locator('[name=card-motion]').count(), 0);
      for (const expected of ['off', 'on', 'off', 'on']) {
        await toggle.click();
        assert.equal(await page.evaluate(() => CardexTheme.getMotion()), expected);
        assert.equal(await toggle.getAttribute('aria-pressed'), String(expected === 'on'));
        assert.equal(await toggle.textContent(), expected === 'on' ? '카드 효과 켜짐' : '카드 효과 꺼짐');
        assert.equal(await toggle.evaluate(el => el === document.activeElement), true);
      }
      await reveal(page, 'preview');
      await page.locator('[data-open=sample-1]').click();
      const front = page.locator('.flip-trigger');
      const hoverCard = async () => {
        const box = await front.boundingBox();
        await page.mouse.move(0, 0);
        await page.mouse.move(box.x + box.width * .7, box.y + box.height * .3, { steps: 4 });
        await page.waitForTimeout(120);
        return page.locator('.tilt-layer').evaluate(el => ({ shine: el.style.getPropertyValue('--shine'),
          angles: ['--tilt-x', '--tilt-y'].map(k => parseFloat(el.style.getPropertyValue(k)) || 0),
          transform: getComputedStyle(el).transform, light: getComputedStyle(el.querySelector('.flip-light')).display,
          flip: getComputedStyle(el.querySelector('.flip-inner')).transitionDuration }));
      };
      const on = await hoverCard();
      assert.equal(on.shine, '1');
      assert.ok(on.angles.every(n => n > 0 && n <= 9));
      assert.notEqual(on.transform, 'none'); assert.notEqual(on.light, 'none'); assert.equal(on.flip, '0.6s');
      await page.evaluate(() => CardexTheme.setMotion('off'));
      const off = await hoverCard();
      assert.equal(off.shine, '0');
      assert.equal(off.transform, 'none'); assert.equal(off.light, 'none'); assert.equal(off.flip, '0s');
      await page.evaluate(() => CardexTheme.setMotion('bogus'));
      assert.equal(await page.evaluate(() => CardexTheme.getMotion()), 'off');
      await page.reload(); await page.waitForFunction(() => DiaryReview.isReady());
      assert.equal(await page.evaluate(() => CardexTheme.getMotion()), 'off', 'off persists');
      await page.evaluate(() => CardexTheme.setMotion('on'));
      await page.reload(); await page.waitForFunction(() => DiaryReview.isReady());
      assert.equal(await page.evaluate(() => CardexTheme.getMotion()), 'on', 'on persists');
      for (const [stored, expected] of [['auto', 'on'], ['<script>', 'on'], [null, 'on'], ['off', 'off']]) {
        await page.evaluate(value => {
          const key = 'moment-card:diary-simple-v3:card-motion';
          if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value);
        }, stored);
        await page.reload(); await page.waitForFunction(() => DiaryReview.isReady());
        assert.equal(await page.evaluate(() => CardexTheme.getMotion()), expected, `stored ${stored}`);
      }
      await reveal(page,'settings');
      const other = await context.newPage();
      await other.goto(page.url()); await other.waitForFunction(() => DiaryReview.isReady());
      await other.evaluate(() => CardexTheme.setMotion('on'));
      await page.waitForFunction(() => CardexTheme.getMotion() === 'on');
      assert.equal(await toggle.getAttribute('aria-pressed'), 'true', 'storage event syncs toggle');
      await context.close();
    }
    assert.deepEqual(errors, []);
    console.log('PASS: 18 palettes, desktop/touch effects, flip/keyboard, reduced motion, mobile layout, card-motion single toggle/migration/persistence');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

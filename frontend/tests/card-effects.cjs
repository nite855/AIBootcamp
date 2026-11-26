const {reveal,unseal}=require('./browser-runtime.cjs');
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.CARDEX_PLAYWRIGHT || path.join(os.tmpdir(), 'aibootcamp-frontend-review/node_modules/playwright'));

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: require('./browser-runtime.cjs').executablePath });
  try {
    await require('./modal-foil.cjs')(browser);
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
      await page.locator('[data-open=sample-1]').click(); await unseal(page);
      const pairs = await page.evaluate(() => CardexTheme.themes.map(t => [t.id, t.scheme]));
      const client = mobile ? await context.newCDPSession(page) : null;
      for (const [id, mode] of pairs) for (const reducedMotion of ['no-preference', 'reduce']) {
        await page.emulateMedia({ reducedMotion });
        await page.evaluate(({ id, mode }) => { CardexTheme.setTheme(id); CardexTheme.setMotion('on'); }, { id, mode });
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
          return { width: el.getBoundingClientRect().width, art: read('.art-card', ['borderRadius', 'filter']), rear: read('.flip-back', ['borderRadius', 'boxShadow']),
            perspective: read(null, ['perspective']), flip: read('.flip-inner', ['transitionDuration']),
            tilt: read('.tilt-layer', ['transitionDuration']), light: read('.flip-light', ['borderRadius', 'transitionDuration', 'backgroundImage', 'mixBlendMode']) };
        });
        // 5:7 card corners follow the SVG at every width (rx 96 of 1080 ≈ 8.9% of the width, 2026-11-22: --card-r).
        const radius = styles.width * 96 / 1080;
        for (const value of [styles.art[0], styles.rear[0], styles.light[0]]) assert.ok(Math.abs(parseFloat(value) - radius) <= 1, `${id}/${mode}: card corner ${value} = ${radius.toFixed(1)}px`);
        // Everything else is the same in every theme and viewport.
        const common = { ...styles, width: 0, art: styles.art.slice(1), rear: styles.rear.slice(1), light: styles.light.slice(1) };
        if (!baseline) baseline = common;
        assert.deepEqual(common, baseline, `${id}/${mode}: common effects`);
        assert.ok(parseFloat(styles.art[0]) >= 20, 'rounded card corners ' + styles.art[0]); assert.notEqual(styles.art[1], 'none');
        assert.equal(styles.rear[0], styles.art[0]); assert.notEqual(styles.rear[1], 'none');
        assert.deepEqual(styles.perspective, ['1200px']); assert.deepEqual(styles.flip, ['0.6s']);
        assert.deepEqual(styles.tilt, ['0.18s']); assert.equal(styles.light[1], '0.2s');
        const boxes = await page.locator('.flip-scene').evaluate(el => ['.art-card','.flip-front .flip-light','.flip-back'].map(s => { const r=el.querySelector(s).getBoundingClientRect(); return [r.x,r.y,r.width,r.height]; }));
        for (const other of boxes.slice(1)) boxes[0].forEach((v,i)=>assert.ok(Math.abs(v-other[i])<=1, `${id}/${mode}: card/light/rear geometry`));
        assert.ok(Math.abs(boxes[0][2]/boxes[0][3]-5/7)<.01, 'moment card is 5:7');
        for (const action of ['read-full','favorite','download']) assert.equal(await page.locator(`[data-action=${action}]`).count(),1);
        // The page keeps the scroll position it was opened with (taller profile copy on phones moved it
        // past the card top, 2026-11-24); centre the card so the pointer lands on it in every run.
        await front.evaluate(el => el.scrollIntoView({ block: 'center' }));
        const box = await front.boundingBox();
        const point = { x: box.x + box.width * .7, y: box.y + box.height * .3 };
        if (mobile) {
          await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
          // No long-press delay: light is visible on the next animation frame.
        } else await page.mouse.move(point.x, point.y);
        // The light still has to come on within 400ms of a move. On desktop the first move can land before the
        // card's pointer handlers are bound after a theme re-render and is then lost (flaky about half the runs,
        // 2026-11-24), so a lost move is followed by one more 1px move, as a real pointer would keep sending.
        const shineOn = () => page.waitForFunction(() => document.querySelector('.tilt-layer').style.getPropertyValue('--shine') === '1', null, { timeout: 400 });
        if (mobile) await shineOn();
        else await shineOn().catch(async () => { await page.mouse.move(point.x + 1, point.y); await shineOn(); });
        const angles = await page.locator('.tilt-layer').evaluate(el => ['--tilt-x', '--tilt-y'].map(k => parseFloat(el.style.getPropertyValue(k))));
        assert.ok(angles.every(n => n > 0 && n <= 9));
        if (mobile) {
          // Horizontal drag keeps the card gesture; vertical drag belongs to native scrolling.
          const moved = { x: box.x + box.width * .3, y: point.y };
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
        // Card effects stay on: the old off switch is a no-op.
        await page.evaluate(() => CardexTheme.setMotion('off'));
        assert.equal(await page.locator('.flip-inner').evaluate(el => getComputedStyle(el).transitionDuration), '0.6s');
        await page.waitForTimeout(650);
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
        if (id === 'blossom') await page.screenshot({ path: path.join(os.tmpdir(), `card-effects-${mobile ? 'mobile' : 'desktop'}-${mode}.png`) });
      }
      await context.close();
    }
    // Card effects are always on: no settings toggle, OS reduced motion and old stored choices are ignored.
    {
      const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1366, height: 768 } });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      for (const stored of ['off', 'auto', '<script>', null]) {
        await page.addInitScript(value => {
          const key = 'moment-card:diary-simple-v3:card-motion';
          try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch {}
        }, stored);
      }
      await page.goto(process.env.CARDEX_TEST_URL || pathToFileURL(path.resolve(__dirname, '../index.html')).href);
      await page.waitForFunction(() => DiaryReview.isReady());
      for (const stored of ['off', 'auto', '<script>']) {
        await page.evaluate(value => localStorage.setItem('moment-card:diary-simple-v3:card-motion', value), stored);
        await page.reload(); await page.waitForFunction(() => DiaryReview.isReady());
        assert.equal(await page.evaluate(() => CardexTheme.getMotion()), 'on', `stored ${stored} is ignored`);
        assert.equal(await page.evaluate(() => document.documentElement.dataset.motion), 'on');
      }
      await reveal(page, 'settings');
      assert.equal(await page.locator('[data-card-motion-toggle], [name=card-motion], .effect-fieldset').count(), 0, 'no card effect option');
      await reveal(page, 'preview');
      await page.locator('[data-open=sample-1]').click(); await unseal(page);
      const front = page.locator('.flip-trigger');
      const box = await front.boundingBox();
      await page.mouse.move(0, 0);
      await page.mouse.move(box.x + box.width * .7, box.y + box.height * .3, { steps: 4 });
      await page.waitForTimeout(120);
      const on = await page.locator('.tilt-layer').evaluate(el => ({ shine: el.style.getPropertyValue('--shine'),
        transform: getComputedStyle(el).transform, light: getComputedStyle(el.querySelector('.flip-light')).display,
        flip: getComputedStyle(el.querySelector('.flip-inner')).transitionDuration }));
      assert.equal(on.shine, '1', 'reduced-motion device still gets the light');
      assert.notEqual(on.transform, 'none'); assert.notEqual(on.light, 'none'); assert.equal(on.flip, '0.6s');
      await page.evaluate(() => CardexTheme.setMotion('off'));
      assert.equal(await page.evaluate(() => CardexTheme.getMotion()), 'on', 'setMotion is a no-op');
      await context.close();
    }
    assert.deepEqual(errors, []);
    console.log('PASS: 10 themes, desktop/touch effects, flip/keyboard, reduced motion, mobile layout, card effects always on (no toggle, reduced motion and stored choices ignored)');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

// Portable Chromium regression cases, not physical Samsung Internet/iOS keyboard emulation.
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.CARDEX_PLAYWRIGHT || path.join(os.tmpdir(), 'aibootcamp-frontend-review/node_modules/playwright'));
const { executablePath, reveal } = require('./browser-runtime.cjs');
const url = pathToFileURL(path.resolve(__dirname, '../index.html')).href;

async function expectMenu(page, hidden) {
  await page.waitForFunction(hidden => {
    const root = document.documentElement;
    return root.classList.contains('mobile-input-active') === hidden
      && (getComputedStyle(document.querySelector('.tabs')).display === 'none') === hidden;
  }, hidden, { timeout: 3000 });
  if (hidden) {
    assert.equal(await page.locator('.shell').evaluate(el => getComputedStyle(el).paddingBottom), '10px');
    assert.equal(await page.locator('.tabs button:visible').count(), 0, 'hidden tabs cannot be clicked or tabbed to');
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath });
  const evidence = fs.mkdtempSync(path.join(os.tmpdir(), 'moment-mobile-input-'));
  const errors = [];
  try {
    for (const noVisualViewport of [false, true]) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, offline: true });
      if (noVisualViewport) await context.addInitScript(() => Object.defineProperty(window, 'visualViewport', { configurable: true, value: undefined }));
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(url);
      await page.waitForFunction(() => DiaryReview.isReady());
      await expectMenu(page, false);

      const draft = 'MOBILE_INPUT 회귀 검사용 초안';
      await page.locator('#diary-text').fill(draft);
      await expectMenu(page, true);
      await page.locator('#diary-text').evaluate(el => el.setSelectionRange(3, 7));
      await page.evaluate(() => window.testInnerHeightDescriptor = Object.getOwnPropertyDescriptor(window, 'innerHeight'));

      // Visual-only, dual-resize, overlay and a small height change (< the old 25% threshold).
      for (const [inner, visual, scale] of [[844, 440, 1], [440, 440, 1], [844, 844, 1], [844, 760, 1], [844, 422, 2]]) {
        await page.evaluate(({ inner, visual, scale }) => {
          Object.defineProperty(window, 'innerHeight', { configurable: true, value: inner });
          if (window.visualViewport) {
            Object.defineProperty(visualViewport, 'height', { configurable: true, value: visual });
            Object.defineProperty(visualViewport, 'scale', { configurable: true, value: scale });
            visualViewport.dispatchEvent(new Event('resize'));
          }
          window.dispatchEvent(new Event('resize'));
        }, { inner, visual, scale });
        await expectMenu(page, true);
        assert.deepEqual(await page.locator('#diary-text').evaluate(el => [el.value, el.selectionStart, el.selectionEnd]), [draft, 3, 7]);
      }
      // Closing a keyboard without blurring must retain the agreed focus-based policy.
      await page.evaluate(() => {
        Object.defineProperty(window, 'innerHeight', window.testInnerHeightDescriptor);
        delete window.testInnerHeightDescriptor;
        if (window.visualViewport) {
          delete visualViewport.height; delete visualViewport.scale;
          visualViewport.dispatchEvent(new Event('resize'));
        }
        window.dispatchEvent(new Event('resize'));
      });
      await expectMenu(page, true);
      await page.locator('header .brand').focus();
      await expectMenu(page, false);

      // Address-bar changes and pinch zoom alone do not hide navigation.
      if (!noVisualViewport) {
        await page.evaluate(() => {
          Object.defineProperty(visualViewport, 'height', { configurable: true, value: 400 });
          Object.defineProperty(visualViewport, 'scale', { configurable: true, value: 2 });
          visualViewport.dispatchEvent(new Event('resize'));
        });
        await expectMenu(page, false);
        await page.evaluate(() => { delete visualViewport.height; delete visualViewport.scale; visualViewport.dispatchEvent(new Event('resize')); });
      }

      // Search renders on each input; a replacement must keep focus and menu state.
      await reveal(page, 'archive-records');
      await page.locator('#record-search').fill('회귀 검색');
      await expectMenu(page, true);
      assert.equal(await page.locator('#record-search').evaluate(el => el === document.activeElement), true);
      await page.locator('header .brand-word').tap();
      await expectMenu(page, false);
      assert.equal(await page.locator('#diary-text').inputValue(), draft);

      // Profile dialog autofocus, then cancel restores the opener and the tabs.
      await reveal(page, 'settings');
      await page.locator('[data-profile-edit]').click();
      await expectMenu(page, true);
      await page.locator('#profile-name-input').fill('검증');
      await page.locator('[data-profile-cancel]').click();
      await expectMenu(page, false);
      await page.locator('header .brand-word').tap();

      // Test input categories and focus transfer independently of app-specific fields.
      await page.evaluate(() => {
        const fixture = document.createElement('div'); fixture.id = 'input-fixture';
        fixture.innerHTML = '<input id="test-text"><input id="test-second"><textarea id="test-readonly" readonly></textarea><input id="test-check" type="checkbox"><input id="test-radio" type="radio"><button id="test-button">outside</button><select id="test-select"><option>one</option></select><fieldset disabled><input id="test-disabled"></fieldset><div id="test-editable" contenteditable="true">editable</div>';
        document.body.append(fixture);
      });
      for (const type of ['text', 'search', 'email', 'url', 'tel', 'password', 'number']) {
        await page.locator('#test-button').focus();
        await expectMenu(page, false);
        await page.locator('#test-text').evaluate((el, type) => { el.type = type; el.focus(); }, type);
        await expectMenu(page, true);
      }
      await page.evaluate(() => {
        window.menuFlickered = false;
        window.menuObserver = new MutationObserver(() => {
          if (!document.documentElement.classList.contains('mobile-input-active')) window.menuFlickered = true;
        });
        menuObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        document.getElementById('test-second').focus();
      });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      assert.equal(await page.evaluate(() => { menuObserver.disconnect(); return menuFlickered; }), false, 'no menu flash between editable inputs');
      for (const selector of ['#test-readonly', '#test-check', '#test-radio', '#test-button', '#test-select']) {
        await page.locator('#test-second').focus();
        await expectMenu(page, true);
        await page.locator(selector).focus();
        await expectMenu(page, false);
      }
      await page.locator('#test-disabled').evaluate(el => el.focus());
      await expectMenu(page, false);
      await page.locator('#test-editable').focus();
      await expectMenu(page, true);
      await page.locator('#test-second').focus();
      await page.locator('#test-second').evaluate(el => el.remove());
      await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
      await expectMenu(page, false);
      await page.locator('#input-fixture').evaluate(el => el.remove());

      for (const [width, height] of [[320, 568], [390, 844], [430, 932], [844, 390], [959, 800], [960, 800], [1440, 900], [390, 844]]) {
        await page.setViewportSize({ width, height });
        await page.locator('#diary-text').focus();
        await expectMenu(page, width < 960);
        await page.evaluate(() => { window.dispatchEvent(new Event('focus')); window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })); });
        await expectMenu(page, width < 960);
        assert.equal(await page.locator('#diary-text').inputValue(), draft);
        assert.equal(await page.locator('#diary-text').evaluate(el => el === document.activeElement), true);
        if (width === 390 && !noVisualViewport) await page.screenshot({ path: path.join(evidence, 'input-focused.png') });
        await page.locator('header .brand').focus();
        await expectMenu(page, false);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false);
        if (width < 960) {
          const tabs = await page.locator('.tabs').boundingBox();
          assert.ok(tabs.y >= 0 && tabs.y + tabs.height <= height + 1, 'restored tabs inside viewport');
        }
      }

      // Hit-test and tap both the word and the button edge in each destination.
      for (const action of ['review-month', 'catalog', 'settings']) {
        await reveal(page, action);
        const brand = page.getByRole('button', { name: '기록 홈으로 이동', exact: true });
        const box = await brand.boundingBox();
        assert.ok(box.width >= 44 && box.height >= 44);
        assert.equal(await brand.evaluate(el => {
          const r = el.getBoundingClientRect();
          return [[r.left + 2, r.top + r.height / 2], [r.left + r.width / 2, r.top + r.height / 2]].every(([x, y]) => el.contains(document.elementFromPoint(x, y)));
        }), true, 'brand touch targets are unobstructed');
        await page.locator('header .brand-word').tap();
        assert.equal(await page.evaluate(() => DiaryReview.getState().view), 'write');
        assert.equal(await page.locator('#diary-text').inputValue(), draft);
        await reveal(page, action);
        await brand.tap({ position: { x: 2, y: 22 } });
        assert.equal(await page.evaluate(() => DiaryReview.getState().view), 'write');
      }
      for (const key of ['Enter', 'Space']) {
        await reveal(page, 'settings');
        await page.locator('header .brand').focus(); await page.keyboard.press(key);
        await page.locator('#diary-text').waitFor();
        assert.equal(await page.locator('#diary-text').inputValue(), draft);
      }
      // Real save opens the pending card; brand returns home without a document reload.
      const documentMarker = await page.evaluate(() => window.mobileInputDocument = Math.random());
      await reveal(page, 'save', { stay: true });
      await page.locator('.wait-panel').waitFor();
      await page.locator('header .brand-word').tap();
      await expectMenu(page, false);
      assert.equal(await page.evaluate(() => DiaryReview.getState().view), 'write');
      assert.equal(await page.evaluate(() => window.mobileInputDocument), documentMarker);
      if (!noVisualViewport) await page.screenshot({ path: path.join(evidence, 'menu-restored.png') });
      await context.close();
    }
    assert.deepEqual(errors, []);
    console.log('PASS: focus policy, viewport variants/fallback, search render, profile dialog, input categories, focus transfer, breakpoints, return, brand touch/keyboard and draft preservation. Evidence: ' + evidence);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

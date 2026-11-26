// Keyboard close with retained focus (Android), and blur on close (iOS-like event order).
// Viewport signals are mocked; these cases do not replace physical device checks.
const assert = require('node:assert/strict');
const path = require('node:path'), os = require('node:os');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.CARDEX_PLAYWRIGHT || path.join(os.tmpdir(), 'aibootcamp-frontend-review/node_modules/playwright'));
const { executablePath, reveal } = require('./browser-runtime.cjs');

async function expectMenu(page, hidden) {
  await page.waitForFunction(hidden =>
    document.documentElement.classList.contains('mobile-input-active') === hidden
    && (getComputedStyle(document.querySelector('.tabs')).display === 'none') === hidden,
  hidden, { timeout: 3000 });
}
async function viewport(page, inner, visual = inner, scale = 1) {
  await page.evaluate(({ inner, visual, scale }) => {
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: inner });
    if (window.visualViewport) {
      Object.defineProperty(visualViewport, 'height', { configurable: true, value: visual });
      Object.defineProperty(visualViewport, 'scale', { configurable: true, value: scale });
      visualViewport.dispatchEvent(new Event('resize'));
    }
    window.dispatchEvent(new Event('resize'));
  }, { inner, visual, scale });
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath });
  const errors = [];
  try {
    for (const noVisualViewport of [false, true]) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, offline: true });
      await context.addInitScript(noVisualViewport => {
        if (noVisualViewport) Object.defineProperty(window, 'visualViewport', { configurable: true, value: undefined });
        const keyboard = new EventTarget(); keyboard.boundingRect = { height: 0 };
        Object.defineProperty(navigator, 'virtualKeyboard', { configurable: true, value: keyboard });
      }, noVisualViewport);
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
      await page.waitForFunction(() => DiaryReview.isReady());
      const draft = 'KEYBOARD_CLOSE 초안과 커서 유지';
      await page.locator('#diary-text').fill(draft);
      // Visual-only shrink, both viewports shrinking, and window-only fallback.
      for (const [inner, visual] of (noVisualViewport ? [[440, 440]] : [[844, 440], [440, 440]])) {
        await page.locator('header .brand').focus();
        await viewport(page, 844);
        await page.locator('#diary-text').focus();
        await page.locator('#diary-text').evaluate(el => el.setSelectionRange(3, 7));
        await expectMenu(page, true);
        await viewport(page, inner, visual);
        await expectMenu(page, true);
        await viewport(page, 844);
        // Back hides the keyboard while document.activeElement remains the textarea.
        await expectMenu(page, false);
        assert.deepEqual(await page.locator('#diary-text').evaluate(el => [el === document.activeElement, el.value, el.selectionStart, el.selectionEnd]), [true, draft, 3, 7]);
        await page.evaluate(() => { window.dispatchEvent(new Event('focus')); window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })); });
        await expectMenu(page, false);
        // Tapping the already focused field does not generate focusin: hide again anyway.
        await page.locator('#diary-text').tap();
        await expectMenu(page, true);
        await viewport(page, inner, visual);
        await expectMenu(page, true);
        await page.locator('#diary-text').tap(); // Repositioning the caret must retain the pre-keyboard baseline.
        // Simulate several close animation frames and a changed address-bar height.
        await viewport(page, 844, noVisualViewport ? 844 : 650);
        if (!noVisualViewport) await expectMenu(page, true);
        await viewport(page, 780);
        await expectMenu(page, false);
      }
      await page.locator('header .brand').focus();
      await viewport(page, 844);
      await page.locator('#diary-text').focus();
      await viewport(page, 760);
      await viewport(page, 844);
      await expectMenu(page, true); // Small address-bar motion is not a keyboard close.
      if (!noVisualViewport) {
        await viewport(page, 844, 422, 2);
        await viewport(page, 844);
        await expectMenu(page, true); // Pinch zoom does not simulate a keyboard cycle.
      }
      await viewport(page, 440);
      await page.locator('header .brand').focus(); // Blur before the close event (iOS-like).
      await expectMenu(page, false);
      await viewport(page, 844);
      await expectMenu(page, false);

      // Some browsers deliver resize before focusin; closing must still restore the menu.
      await viewport(page, 440);
      await page.locator('#diary-text').focus();
      await expectMenu(page, true);
      await viewport(page, 844);
      await expectMenu(page, false);
      await page.locator('.tabs [data-action="catalog"]').tap();
      assert.equal(await page.evaluate(() => DiaryReview.getState().archiveTab), 'catalog', 'restored bottom tabs respond to touch');
      await page.locator('header .brand').click();

      // Overlay keyboards can signal closure through geometrychange without any resize.
      await page.locator('#diary-text').focus();
      for (const [height, hidden] of [[300, true], [0, false], [300, true], [0, false]]) {
        await page.evaluate(height => { navigator.virtualKeyboard.boundingRect.height = height; navigator.virtualKeyboard.dispatchEvent(new Event('geometrychange')); }, height);
        await expectMenu(page, hidden);
      }
      // Search replaces the input on render; a dismissed keyboard must not hide tabs again.
      await page.locator('header .brand').focus();
      await reveal(page, 'archive-records');
      await page.locator('#record-search').fill('찾기');
      await viewport(page, 440);
      await viewport(page, 844);
      await expectMenu(page, false);
      await page.locator('#record-search').evaluate(el => { el.value = '다시 찾기'; el.dispatchEvent(new Event('input', { bubbles: true })); });
      await expectMenu(page, false);
      assert.equal(await page.locator('#record-search').evaluate(el => el === document.activeElement), true);
      await page.locator('header .brand').click();
      assert.equal(await page.locator('#diary-text').inputValue(), draft);
      await context.close();
    }
    assert.deepEqual(errors, []);
    console.log('PASS: close with retained focus, visual/dual/window resize, re-tap/reopen, close animation, toolbar/zoom guards, blur on close, overlay geometry, rerender and draft/caret preservation');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

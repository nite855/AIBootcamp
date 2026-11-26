// 2026-11-21 statistics entry motion: opening statistics draws the charts once (summary tiles fade,
// numbers count up, trend line draws, dots/bars/calendar cells grow in order). It plays again on a
// month change or after leaving and coming back, but not on other re-renders of the same screen
// (breakpoint redraw, card modal). Empty months render with the motion and no errors.
const assert = require('node:assert/strict'), path = require('node:path'), { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.CARDEX_PLAYWRIGHT || path.join(require('node:os').tmpdir(), 'aibootcamp-frontend-review/node_modules/playwright'));
const { executablePath, reveal, settleStats } = require('./browser-runtime.cjs');
const ANIM = '[data-stats-anim="in"]';
// Names of the running animations on a selector's first match (inside the stats screen).
const running = (page, selector) => page.locator(selector).first().evaluate(el => el.getAnimations().filter(a => a.playState === 'running').map(a => a.animationName));
async function openStats(page) {
  // Click the tab directly (reveal() would wait for the motion to finish).
  await page.locator('[data-action="review-month"]:visible').first().click();
  await page.locator('.stats-title').waitFor();
}
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(process.env.CARDEX_TEST_URL || pathToFileURL(path.resolve(__dirname, '../index.html')).href);
    await page.waitForFunction(() => DiaryReview.isReady());

    // Empty month (boundary): the motion is on, the count stays 0, nothing breaks.
    await openStats(page);
    assert.equal(await page.locator(ANIM).count(), 1, 'empty month plays the entry motion');
    await settleStats(page);
    assert.equal(await page.locator('.stats-count .moment-number').innerText(), '0');

    // Example data: the charts draw themselves on entry.
    await reveal(page, 'settings');
    await reveal(page, 'preview');
    await reveal(page, 'write');
    await openStats(page);
    assert.equal(await page.locator(ANIM).count(), 1, 'entry adds the motion marker');
    assert.ok((await running(page, `${ANIM} .stats-chart .chart-line`)).includes('stats-draw'), 'trend line draws');
    assert.equal(await page.locator(`${ANIM} .stats-chart .chart-line`).first().getAttribute('pathLength'), '1');
    assert.ok((await running(page, `${ANIM} .dist-bar b`)).includes('stats-wipe-x'), 'distribution bars grow');
    assert.ok((await running(page, `${ANIM} .weekday-bar`)).includes('stats-wipe-up'), 'weekday bars rise');
    assert.ok((await running(page, `${ANIM} .emo-calendar .emo-day`)).includes('stats-cell'), 'calendar cells settle in');
    assert.ok((await running(page, `${ANIM} .trend-dots li > *`)).includes('stats-pop'), 'card dots pop in');
    // Later days start later (stagger by --i).
    const delays = await page.locator(`${ANIM} .emo-calendar .emo-day`).evaluateAll(xs => [xs[0], xs[xs.length - 1]].map(x => parseFloat(getComputedStyle(x).animationDelay)));
    assert.ok(delays[1] > delays[0], 'calendar cells are staggered: ' + delays);
    // The numbers count up and end exactly on the final values.
    const finals = await page.locator(`${ANIM} [data-count]`).evaluateAll(xs => xs.map(x => x.dataset.count));
    assert.ok(finals.length >= 4, 'record count and three ratio shares count up');
    await settleStats(page);
    assert.deepEqual(await page.locator(`${ANIM} [data-count]`).allInnerTexts(), finals);
    assert.equal(await page.evaluate(sel => document.querySelector(sel).getAnimations({ subtree: true }).filter(a => a.playState === 'running' && String(a.animationName).startsWith('stats-')).length, ANIM), 0, 'motion finishes');
    // Final state matches the data: the longest distribution bar is full width.
    const widths = await page.locator('.dist-bar').evaluateAll(xs => xs.map(x => x.querySelector('b').getBoundingClientRect().width / x.getBoundingClientRect().width));
    assert.ok(Math.abs(Math.max(...widths) - 1) < 0.01, 'bars end at their data width: ' + widths);

    // Card modal open/close does not replay (the screen is not rebuilt and nothing runs again).
    await page.evaluate(() => { window.__statsRoot = document.querySelector('.stats-page'); });
    await page.locator('.stats-calendar button[data-card-day]').first().click();
    await page.locator('#card-modal[open]').waitFor();
    await page.keyboard.press('Escape');
    await page.locator('#card-modal[open]').waitFor({ state: 'detached' }).catch(() => {});
    await page.waitForFunction(() => !document.querySelector('#card-modal[open]'));
    assert.deepEqual(await page.evaluate(() => {
      const root = document.querySelector('.stats-page');
      return [root === window.__statsRoot, root.getAnimations({ subtree: true }).filter(a => a.playState === 'running' && String(a.animationName).startsWith('stats-')).length];
    }), [true, 0], 'card modal keeps the screen still');

    // A breakpoint redraw of the same screen does not replay.
    await page.setViewportSize({ width: 800, height: 900 });
    await page.waitForFunction(() => document.querySelector('.stats-chart')?.getAttribute('viewBox')?.startsWith('0 0 360'));
    assert.equal(await page.locator(ANIM).count(), 0, 'same-screen re-render keeps the screen still');
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForFunction(() => document.querySelector('.stats-chart')?.getAttribute('viewBox')?.startsWith('0 0 756'));

    // Changing the month replays (both directions).
    await page.locator('[data-month-step="-1"]').click();
    assert.equal(await page.locator(ANIM).count(), 1, 'previous month draws again');
    await settleStats(page);
    await page.locator('[data-month-step="1"]').click();
    assert.equal(await page.locator(ANIM).count(), 1, 'back to this month draws again');
    await settleStats(page);

    // Leaving and coming back replays.
    await page.locator('[data-action="catalog"]:visible').first().click();
    await openStats(page);
    assert.equal(await page.locator(ANIM).count(), 1, 'coming back draws again');
    await settleStats(page);

    // Phones: the weekday rows fill from the left.
    const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
    phone.on('pageerror', e => errors.push(e.message));
    await phone.goto(process.env.CARDEX_TEST_URL || pathToFileURL(path.resolve(__dirname, '../index.html')).href);
    await phone.waitForFunction(() => DiaryReview.isReady());
    await reveal(phone, 'settings');
    await reveal(phone, 'preview');
    await reveal(phone, 'write');
    await openStats(phone);
    assert.ok((await running(phone, `${ANIM} .weekday-bar`)).includes('stats-wipe-x'), 'phone weekday rows wipe sideways');
    await settleStats(phone);
    assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);

    assert.deepEqual(errors, []);
    console.log('PASS: statistics entry motion — draws on entry, month change and return; still on modal and breakpoint redraw; counts end exact; empty month ok; phone rows wipe sideways');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });

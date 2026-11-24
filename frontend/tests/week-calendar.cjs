// 2026-11-20 soft UI v1.1 record screen: week card rail, month card calendar, streak chip,
// card modal (bottom sheet on phones), plus the statistics screen without the month input,
// date select and its week/day snippet calendar (phones). Plain Node script.
const assert = require('node:assert/strict'), path = require('node:path'), { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.CARDEX_PLAYWRIGHT || path.join(require('node:os').tmpdir(), 'aibootcamp-frontend-review/node_modules/playwright'));
const { executablePath, reveal } = require('./browser-runtime.cjs');
const LONG = '<b>굵게</b> 아주아주 긴 첫 줄 미리보기 문장이 계속 이어집니다';
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath });
  try {
    for (const [width, height] of [[1440, 900], [390, 844]]) {
      const page = await browser.newPage({ viewport: { width, height } });
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(process.env.CARDEX_TEST_URL || pathToFileURL(path.resolve(__dirname, '../index.html')).href);
      await page.waitForFunction(() => DiaryReview.isReady());
      const today = await page.evaluate(() => DiaryReview.localDate());
      const desktop = width >= 960;
      const panel = page.locator('.write-calendar');

      // First run (Figma "기록 · 첫 실행"): the guide replaces today's card and the calendar.
      assert.equal(await page.locator('.how-panel .how-steps li').count(), 3);
      assert.equal(await panel.count(), 0, 'no calendar before the first record');

      // Statistics: no duplicate month input or date select.
      await reveal(page, 'review-month');
      assert.equal(await page.locator('#stats-month').count(), 0);
      assert.equal(await page.locator('#stats-date').count(), 0);

      // Saving today fills today's slot with a (locked, pending) mini card and starts a streak.
      await reveal(page, 'write');
      await page.locator('#diary-text').fill(LONG + '\n둘째 줄');
      await reveal(page, 'save');
      await page.waitForFunction(() => DiaryReview.getState().sessions.length === 1);
      if (await page.locator('dialog[open]').count()) await page.keyboard.press('Escape');
      await reveal(page, 'write');
      const todayCard = panel.locator(`button.day-card[data-card-day="${today}"]`);
      // Week rail: 7 slots, today outlined, future days dashed and not clickable.
      await panel.scrollIntoViewIfNeeded();
      assert.equal(await panel.isVisible(), true);
      assert.equal(await panel.locator('[data-write-calendar=week]').getAttribute('aria-pressed'), 'true', 'week view is the default');
      assert.equal(await panel.locator('.week-rail .day-card').count(), 7);
      assert.equal(await panel.locator('.day-card[aria-current=date]').count(), 1);
      assert.equal(await panel.locator('button.day-card.is-future').count(), 0, 'future days are not clickable');
      assert.equal(await panel.locator('.week-rail .rail-date').count(), 7, 'date numbers under the cards');
      assert.match(await panel.locator('.calendar-title').innerText(), /^\d{1,2}월 \d주/);
      assert.equal(await todayCard.count(), 1);
      assert.equal(await todayCard.locator('.mini-card.is-locked').count(), 1, 'unanalyzed record shows the locked frame');
      const label = await todayCard.getAttribute('aria-label');
      assert.ok(label.includes('오늘') && label.includes('분석 대기') && label.includes('<b>굵게</b>'), 'label: ' + label);
      assert.equal(await panel.locator('.day-card b').count(), 0, 'record text never becomes markup');
      // A first day is not a streak (2026-11-24 critique: no number pressure on day one); it shows from day 2.
      assert.equal(await panel.locator('.streak-chip').count(), 0, 'no "1일 연속" chip');
      assert.equal(await page.locator('.today-panel.has-card .today-card').count(), 1);

      // Week navigation: no future weeks, focus stays on the pressed (or remaining) arrow.
      assert.equal(await panel.locator('[data-week-step="1"]').isDisabled(), true, 'no future weeks');
      const title = await panel.locator('.calendar-title').innerText();
      await panel.locator('[data-week-step="-1"]').click();
      assert.notEqual(await panel.locator('.calendar-title').innerText(), title);
      assert.equal(await page.locator('[data-week-step="-1"]').evaluate(el => el === document.activeElement), true);
      await panel.locator('[data-week-step="1"]').click();
      assert.equal(await panel.locator('.calendar-title').innerText(), title);
      assert.equal(await page.locator('[data-week-step="-1"]').evaluate(el => el === document.activeElement), true, 'focus falls back when next disables');

      // Month view: every day of the month, the latest recorded day in the summary row.
      await panel.locator('[data-write-calendar=month]').click();
      assert.equal(await page.locator('[data-write-calendar=month]').evaluate(el => el === document.activeElement), true);
      assert.ok(await panel.locator('.month-cards .day-card').count() >= 28);
      assert.equal(await panel.locator(`.month-cards button[data-card-day="${today}"]`).count(), 1);
      assert.match(await panel.locator('.month-summary-row').innerText(), /오늘/);
      if (desktop) assert.equal(await page.locator('.today-panel').isVisible(), false, 'month view takes the whole side column');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'no horizontal overflow');
      assert.equal(await panel.locator('[data-home-month="1"]').isDisabled(), true, 'no future months');

      // Card modal: opens from the month card, shows the record as text, closes with Escape and returns focus.
      await panel.locator(`.month-cards button[data-card-day="${today}"]`).click();
      const modal = page.locator('#card-modal[open]');
      await modal.waitFor();
      assert.match(await modal.locator('#card-modal-title').innerText(), /분석 대기/);
      assert.ok((await modal.locator('.cm-text').innerText()).startsWith('<b>굵게</b>'));
      assert.equal(await modal.locator('.cm-text b').count(), 0);
      assert.equal(await modal.locator('[data-modal=share]').count(), 0, 'pending cards cannot be shared');
      assert.equal(await modal.locator('[data-modal-step="-1"]').isDisabled(), true, 'only one recorded day');
      assert.equal(await modal.locator('[data-modal-step="1"]').isDisabled(), true);
      const box = await modal.boundingBox();
      if (!desktop) assert.ok(Math.abs(box.y + box.height - height) <= 1 && box.width >= width - 1, 'bottom sheet on phones');
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#card-modal[open]').count(), 0);
      assert.equal(await page.evaluate(() => document.activeElement?.dataset.cardDay), today, 'focus returns to the card');
      await panel.locator('[data-write-calendar=week]').click();


      // Example mode: the modal steps between recorded days; share and catalog leave the record screen.
      await reveal(page, 'settings');
      await reveal(page, 'preview');
      await reveal(page, 'write');
      await panel.scrollIntoViewIfNeeded();
      assert.ok(Number((await panel.locator('.streak-chip').innerText()).match(/\d+/)[0]) > 1, 'example streak');
      const readyDay = panel.locator('button.day-card:has(.mini-card:not(.is-locked))').first();
      const readyDate = await readyDay.getAttribute('data-card-day');
      await readyDay.click();
      await modal.waitFor();
      assert.match(await modal.locator('#card-modal-title').innerText(), /\d단계$/);
      assert.match(await modal.locator('.cm-meta').innerText(), /^No\.\d{3} · 최고 확률 \d+% · 임시 분류/);
      const date = await modal.locator('.cm-date').innerText();
      await modal.locator('[data-modal-step="-1"]').click();
      assert.notEqual(await modal.locator('.cm-date').innerText(), date);
      assert.equal(await page.locator('[data-modal-step="-1"]').evaluate(el => el === document.activeElement), true);
      await modal.locator('[data-modal-step="1"]').click();
      assert.equal(await modal.locator('.cm-date').innerText(), date);
      await modal.locator('[data-modal=share]').click();
      assert.equal(await page.evaluate(() => DiaryReview.getState().view), 'share');
      assert.equal(await page.locator('#card-modal[open]').count(), 0);
      await reveal(page, 'write');
      await panel.locator(`button.day-card[data-card-day="${readyDate}"]`).click();
      await modal.locator('[data-modal=catalog]').click();
      assert.equal(await page.evaluate(() => DiaryReview.getState().archiveTab), 'catalog');

      // Statistics: a trend dot opens the same card modal; focus returns to the dot.
      await reveal(page, 'review-month');
      const dot = page.locator('.trend-dots button.trend-dot.is-ready').first();
      await dot.scrollIntoViewIfNeeded();
      const dotDate = await dot.getAttribute('data-card-day');
      await dot.click();
      await page.locator('#card-modal[open]').waitFor();
      assert.match(await page.locator('#card-modal-title').innerText(), /\d단계$/);
      await page.keyboard.press('Escape');
      assert.equal(await page.evaluate(() => document.activeElement?.dataset.cardDay), dotDate);
      assert.deepEqual(errors, []);
      await page.close();
    }
    console.log('PASS: week card rail, month card calendar, streak chip, card modal (steps, escape focus, bottom sheet, share/catalog), stats without month input/date select');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });

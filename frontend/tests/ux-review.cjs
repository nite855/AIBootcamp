// UX review 2026-11-16: tab label, sort toggle, single-record date shortcut, trend gap legend.
const assert = require('node:assert/strict'), path = require('node:path'), { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.CARDEX_PLAYWRIGHT || path.join(require('node:os').tmpdir(), 'aibootcamp-frontend-review/node_modules/playwright'));
const { executablePath, reveal } = require('./browser-runtime.cjs');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath });
  try {
    for (const [width, height] of [[1366, 900], [320, 568]]) {
      const page = await browser.newPage({ viewport: { width, height } });
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(process.env.CARDEX_TEST_URL || pathToFileURL(path.resolve(__dirname, '../index.html')).href);
      await page.waitForFunction(() => DiaryReview.isReady());
      assert.ok((await page.locator('[data-action="review-month"]').innerText()).includes('통계'));

      // Archive with zero records: sort toggle still works and keeps focus.
      await reveal(page, 'archive-records');
      const sort = page.locator('[data-sort]');
      assert.equal(await sort.getAttribute('aria-pressed'), 'false');
      await sort.click();
      assert.equal(await page.locator('[data-sort]').getAttribute('aria-pressed'), 'true');
      assert.equal(await page.locator('[data-sort]').evaluate(el => el === document.activeElement), true);

      // Two records: oldest-first puts the first one on top.
      await reveal(page, 'write');
      for (const text of ['첫 번째 검증', '두 번째 검증']) {
        await page.locator('#diary-text').fill(text);
        await reveal(page, 'save');
      }
      await page.waitForFunction(() => DiaryReview.getState().sessions.length >= 1);
      const count = await page.evaluate(() => DiaryReview.getState().sessions.length);
      await reveal(page, 'archive-records');
      const first = await page.locator('.entry-preview').first().innerText();
      if (count === 2) assert.equal(first, '첫 번째 검증', 'oldest first while toggled');

      // Single record on a date opens the detail directly from the statistics screen.
      if (count === 1) {
        // Record tab: the card calendar; statistics: the emotion calendar (soft UI v1.1, every width).
        const today = await page.evaluate(() => DiaryReview.localDate());
        await reveal(page, 'write');
        await page.locator('.write-calendar').scrollIntoViewIfNeeded();
        assert.equal(await page.locator('.write-calendar').isVisible(), true);
        await reveal(page, 'review-month');
        assert.equal(await page.locator('#stats-kind, [data-stats]').count(), 0, 'no stats selector or panel switch');
        if (width >= 960) {
          const [trend, dist] = await Promise.all(['.stats-trend', '.stats-dist'].map(s => page.locator(s).boundingBox()));
          assert.ok(trend.x + trend.width <= dist.x + 1, 'trend left, distribution right');
        }
        // Today's emotion-calendar cell opens the card modal; "기록 자세히" goes to the record page.
        const cell = page.locator(`.stats-calendar [data-card-day="${today}"]`);
        await cell.scrollIntoViewIfNeeded();
        await cell.click();
        await page.locator('#card-modal[open] [data-modal=open]').click();
        await page.locator('.flip-scene').waitFor();
        assert.equal(await page.locator('.entry-list').count(), 0, 'no one-item list');
      }
      // A save from the editor opens the wait panel, which confirms the save itself: no toast over it
      // (2026-11-24 critique, tests/save-feedback.cjs). Emotion filter with pending-only records yields an empty list.
      await reveal(page, 'write');
      await page.locator('#diary-text').fill('토스트 검증');
      await reveal(page, 'save', { stay: true });
      await page.waitForFunction(() => DiaryReview.getState().view === 'entry');
      await page.locator('#wait-title').waitFor();
      assert.equal(await page.locator('#moment-toast.show').count(), 0, 'the wait panel replaces the save toast');
      await reveal(page, 'archive-records');
      await page.locator('.record-filters summary').click();
      await page.selectOption('#emotion-filter', 'neg_1');
      assert.equal(await page.locator('.entry').count(), 0, 'pending records never match an emotion');
      assert.ok((await page.locator('.record-filters summary').innerText()).includes('적용 중'));
      await reveal(page, 'reset-search');
      assert.equal(await page.locator('#emotion-filter').inputValue(), '');
      assert.deepEqual(errors, []);
      await page.close();
    }
    console.log('UX review checks passed');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });

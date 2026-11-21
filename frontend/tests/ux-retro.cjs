// Retrospect UX: month navigation, today mark, analyzed-emotion dots, insight minimum.
const assert = require('node:assert/strict'), path = require('node:path'), { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.CARDEX_PLAYWRIGHT || path.join(require('node:os').tmpdir(), 'aibootcamp-frontend-review/node_modules/playwright'));
const { executablePath, reveal } = require('./browser-runtime.cjs');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath });
  try {
    for (const [width, height] of [[1366, 900], [360, 640]]) {
      const page = await browser.newPage({ viewport: { width, height } });
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(process.env.CARDEX_TEST_URL || pathToFileURL(path.resolve(__dirname, '../index.html')).href);
      await page.waitForFunction(() => DiaryReview.isReady());
      const today = await page.evaluate(() => DiaryReview.localDate());
      const thisMonth = today.slice(0, 7);

      // Real mode without analysis: insight explains the minimum, no emotion dots on pending records.
      await page.locator('#diary-text').fill('돌아보기 검증 기록');
      await reveal(page, 'save');
      await page.waitForFunction(() => DiaryReview.getState().sessions.length === 1);
      await reveal(page, 'review-month');
      const insight = page.locator('.month-insight');
      assert.equal(await insight.getAttribute('data-ready'), 'false');
      assert.ok((await insight.innerText()).includes('지금 0편'));
      // Emotion calendar: today is marked; an unanalyzed record is grey, never an emotion color.
      const todayCell = page.locator(`.stats-calendar [data-card-day="${today}"]`);
      assert.equal(await todayCell.getAttribute('aria-current'), 'date');
      assert.equal(await todayCell.evaluate(el => el.classList.contains('is-ready')), false, 'pending record gets no color');
      assert.equal(await todayCell.locator('.emo-stage').count(), 0);
      assert.match(await todayCell.getAttribute('aria-label'), /분석 대기/);
      assert.match(await page.locator('.stats-ratio').innerText(), /—/, 'no ratio without analysis');

      // Month navigation: next is disabled on the current month; prev/next round-trip keeps focus.
      const prev = page.locator('[data-month-step="-1"]'), next = page.locator('[data-month-step="1"]');
      assert.equal(await next.isDisabled(), true);
      await prev.click();
      assert.equal(await page.locator('#stats-month').count(), 0, 'no separate month input');
      assert.notEqual(await page.locator('.month-title').innerText(), `${thisMonth.slice(0, 4)}년 ${Number(thisMonth.slice(5))}월`);
      assert.equal(await page.locator('[data-month-step="-1"]').evaluate(el => el === document.activeElement), true);
      await page.locator('[data-month-step="1"]').click();
      assert.equal(await page.locator('.month-title').innerText(), `${thisMonth.slice(0, 4)}년 ${Number(thisMonth.slice(5))}월`);
      assert.equal(await page.locator('[data-month-step="-1"]').evaluate(el => el === document.activeElement), true, 'focus falls back when next disables');

      // Example mode (analyzed fixtures): find a month with ≥3 analyzed records and check dots + insight.
      await reveal(page, 'settings');
      await reveal(page, 'preview');
      await reveal(page, 'review-month');
      let checked = false;
      for (let i = 0; i < 12 && !checked; i++) {
        const ready = await page.locator('.month-insight').getAttribute('data-ready').catch(() => null);
        if (ready === 'true') {
          const text = await page.locator('.month-insight').innerText();
          assert.match(text, /분석된 \d+편에서 (가장 큰 비중은|여러 감정이 고르게)/);
          const lead = await page.locator('.month-insight strong').innerText();
          assert.ok(lead.split('·').length <= 4, `insight never lists 3+ tied names: ${lead}`); // a single name may itself contain one '·'
          assert.ok(text.includes('분류 확률'));
          // Analyzed days take their card's color and show the stage as dots.
          const cell = page.locator('.stats-calendar .emo-day.is-ready').first();
          assert.ok(await cell.count() > 0);
          assert.match(await cell.getAttribute('aria-label'), /\d단계/);
          assert.ok(await cell.locator('.emo-stage b').count() >= 1);
          await cell.scrollIntoViewIfNeeded();
          assert.equal(await cell.locator('span').first().isVisible(), true, 'date number visible on every width');
          checked = true;
        } else await page.locator('[data-month-step="-1"]').click();
      }
      assert.ok(checked, 'example data has a month with an insight');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.deepEqual(errors, []);
      await page.close();
    }
    console.log('PASS: month nav/focus, today mark, analyzed dots only, insight minimum and text, desktop/mobile');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

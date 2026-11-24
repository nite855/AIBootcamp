// 2026-11-20 soft UI v1.1 statistics: head with month pill, three summary cards, positive-share
// trend (3-day moving average, mean line, today tooltip, axis ending today) with card dots,
// distribution, emotion calendar, weekday mood, empty state; centred arrows on the record calendar.
const assert = require('node:assert/strict'), path = require('node:path'), { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.CARDEX_PLAYWRIGHT || path.join(require('node:os').tmpdir(), 'aibootcamp-frontend-review/node_modules/playwright'));
const { executablePath, reveal } = require('./browser-runtime.cjs');
async function arrowsCentred(page, where) {
  const offsets = await page.locator('.nav-arrow:visible').evaluateAll(bs => bs.map(b => {
    const r = b.getBoundingClientRect(), s = b.querySelector('svg').getBoundingClientRect();
    return Math.max(Math.abs(r.left + r.width / 2 - (s.left + s.width / 2)), Math.abs(r.top + r.height / 2 - (s.top + s.height / 2)));
  }));
  assert.ok(offsets.length > 0, `${where}: arrows exist`);
  for (const o of offsets) assert.ok(o <= 1.5, `${where}: arrow chevron centred (off by ${o}px)`);
}
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath });
  try {
    for (const [width, height] of [[1440, 900], [390, 844]]) {
      const page = await browser.newPage({ viewport: { width, height } });
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(process.env.CARDEX_TEST_URL || pathToFileURL(path.resolve(__dirname, '../index.html')).href);
      await page.waitForFunction(() => DiaryReview.isReady());
      const desktop = width >= 960, today = await page.evaluate(() => DiaryReview.localDate());
      const month = Number(today.slice(5, 7));


      // Empty month: 0 / — / —, guidance and a write button; no chart sections.
      await reveal(page, 'review-month');
      assert.equal(await page.locator('.stats-title').innerText(), `${month}월의 마음`);
      assert.match(await page.locator('.stats-count').innerText(), /0\s*편/);
      assert.match(await page.locator('.stats-ratio').innerText(), /—/);
      assert.match(await page.locator('.stats-summary-card').innerText(), /—/);
      assert.match(await page.locator('.stats-empty-panel').innerText(), /기록이 쌓이면 마음의 흐름을 보여드릴게요/);
      assert.equal(await page.locator('.stats-chart, .stats-calendar').count(), 0);
      assert.equal(await page.locator('.stats-empty-panel [data-action=write]').count(), 1);
      assert.equal(await page.locator('[data-month-step="1"]').isDisabled(), true, 'no future months');

      // Example data: every section, month pill with neighbour names.
      await reveal(page, 'settings');
      await reveal(page, 'preview');
      // Arrows on the record card calendar in both week and month views (the first run has no calendar).
      await reveal(page, 'write');
      await arrowsCentred(page, 'record week view');
      await page.locator('[data-write-calendar=month]').click();
      await arrowsCentred(page, 'record month view');
      await page.locator('[data-write-calendar=week]').click();
      await reveal(page, 'review-month');
      assert.match(await page.locator('.stats-head').innerText(), /시연용 합성 데이터/);
      assert.equal(await page.locator('.month-pill [aria-current]').innerText(), `${month}월`);
      assert.match(await page.locator('[data-month-step="-1"]').innerText(), /‹ \d{1,2}월/);
      assert.match(await page.locator('.stats-count').innerText(), /지난달보다/);
      const ratio = await page.locator('.ratio-values b').allInnerTexts();
      assert.equal(ratio.length, 3);
      // Whole-number shares (Figma), so rounding may move the sum by one point.
      assert.ok(ratio.every(t => /^\d+$/.test(t)), 'whole-number shares: ' + ratio);
      assert.ok(Math.abs(ratio.reduce((n, t) => n + parseFloat(t), 0) - 100) <= 1.5, 'parent shares add up: ' + ratio);
      assert.equal(await page.locator('.stats-summary-card .mini-card[data-type]').count(), 1, 'top card shows its mini card');
      assert.match(await page.locator('.stats-summary-card').textContent(), /\d+편 · \d(~\d)?단계/, 'top card count and stage range');
      assert.equal(await page.locator('.stats-summary-card').isVisible(), desktop, 'phones leave the top card tile out (Figma)');

      // Trend: one positive line, mean line, today tooltip, axis ending today, one dot per drawn day.
      const chart = page.locator('.stats-chart');
      assert.equal(await chart.count(), 1);
      assert.equal(await chart.locator('.chart-line[data-series=positive]').count() >= 1, true);
      assert.equal(await chart.locator('.chart-line:not([data-series=positive])').count(), 0, 'single series');
      assert.equal(await chart.locator('.chart-mean').count(), 1);
      // The tooltip is for an analyzed today only. Demo data is one record per day since 2026-11-24 and
      // today's demo record is the pending one, so no "오늘 긍정" tooltip is drawn.
      assert.equal(await chart.locator('.chart-today').count(), 0, 'no today tooltip over a pending today');
      assert.equal(Number(await chart.getAttribute('data-days')), Number(today.slice(8)));
      assert.equal(await page.locator('.trend-dots li').count(), Number(today.slice(8)));
      assert.equal(await page.locator('.trend-dots .is-today').count(), 1);
      assert.equal(await page.locator('[data-trend-focus], [data-stats-day], [data-stats]').count(), 0, 'old focus toggle, day stepper and panel switch are gone');
      const box = await chart.boundingBox();
      assert.ok(box.height >= (desktop ? 240 : 160), 'chart height ' + box.height);

      // Distribution: nine rows sorted by count (phones show three).
      const counts = await page.locator('.dist-row strong').allInnerTexts();
      assert.equal(counts.length, 9);
      assert.deepEqual(counts.map(Number), counts.map(Number).slice().sort((a, b) => b - a));
      assert.equal(await page.locator('.dist-row:visible').count(), desktop ? 9 : 3);

      // Emotion calendar: every day, today marked, ready days colored with stage dots.
      assert.ok(await page.locator('.emo-day').count() >= 28);
      assert.equal(await page.locator(`.emo-day[aria-current=date]`).count(), 1);
      assert.ok(await page.locator('.emo-day.is-ready .emo-stage b').count() > 0);
      assert.equal(await page.locator('button.emo-day.is-future').count(), 0, 'future days are not buttons');

      // Weekday mood: 7 rows Sunday first with counts, one insight line.
      assert.deepEqual(await page.locator('.weekday-name').allInnerTexts(), ['일', '월', '화', '수', '목', '금', '토']);
      if (desktop) {
        const bar = await page.locator('.weekday-bar').first().boundingBox();
        assert.ok(bar.height > bar.width * 3, 'vertical stacked bars on desktop (Figma)');
        assert.equal(await page.locator('.stats-mood .stats-calendar, .stats-mood .stats-weekday').count(), 2, 'calendar and weekday share one panel');
      }
      assert.match(await page.locator('.weekday-insight').innerText(), /(요일엔 (긍정|부정)이.*많았어요|요일별 흐름)/);

      if (desktop) {
        const [trend, dist, cal, week] = await Promise.all(['.stats-trend', '.stats-dist', '.stats-calendar', '.stats-weekday'].map(s => page.locator(s).boundingBox()));
        assert.ok(trend.width >= dist.width * 1.6 && trend.x + trend.width <= dist.x + 1, 'trend wide on the left, distribution right');
        assert.ok(cal.y >= trend.y + trend.height - 1 && cal.x + cal.width <= week.x + 1, 'calendar and weekday below');
        const cards = await page.locator('.stats-cards > .panel').evaluateAll(xs => xs.map(x => Math.round(x.getBoundingClientRect().top)));
        assert.equal(new Set(cards).size, 1, 'three summary cards in one row');
      }

      // Month navigation keeps focus on the pressed button (falls back when next disables).
      await page.locator('[data-month-step="-1"]').click();
      assert.equal(await page.locator('[data-month-step="-1"]').evaluate(el => el === document.activeElement), true);
      await page.locator('[data-month-step="1"]').click();
      assert.equal(await page.locator('.month-pill [aria-current]').innerText(), `${month}월`);
      assert.equal(await page.locator('[data-month-step="-1"]').evaluate(el => el === document.activeElement), true);

      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.deepEqual(errors, []);
      await page.close();
    }
    console.log('PASS: soft stats head/pill, summary cards, positive moving-average trend with dots, distribution, emotion calendar, weekday mood, empty state, centred arrows');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });

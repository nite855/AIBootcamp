// 2026-11-24 critique 2 follow-up on the record screen (Plain Node script, Playwright).
// 1) Empty editor: "오늘의 질문" line with "다른 질문" (never inserted into the draft); it hides once there is text.
// 2) Ctrl+Enter saves; the wait panel gives the first sentence back with the long date and is the one way back.
// 3) Done bar: "카드 보기" is secondary for a pending card; no "1일 연속" chip on day one.
// 4) Demo data keeps the product rules (≤ 30 records, one per day) and the demo editor says it writes real records.
// 5) Phones: at most one recent tile (no orphan heading, critique 4), meaningful text is 12px or more.
const assert = require('node:assert/strict'), path = require('node:path'), os = require('node:os');
const { pathToFileURL } = require('node:url');
const { executablePath } = require('./browser-runtime.cjs');
const { chromium } = require(process.env.CARDEX_PLAYWRIGHT || path.join(os.tmpdir(), 'aibootcamp-frontend-review/node_modules/playwright'));
const URL = process.env.CARDEX_TEST_URL || pathToFileURL(path.resolve(__dirname, '../index.html')).href;
const TEXT = '퇴근길에 노을이 예뻐서 한참 걸었다. 집에 와서는 라면을 끓여 먹었다.';

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath });
  try {
    for (const [width, height] of [[1440, 900], [390, 844]]) {
      const mobile = width < 960, tag = `${width}x${height}`;
      const context = await browser.newContext({ viewport: { width, height }, hasTouch: mobile, isMobile: mobile });
      const page = await context.newPage();
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.goto(URL);
      await page.waitForFunction(() => DiaryReview.isReady());
      const editor = page.locator('#diary-text');

      // 1) Today's question under the empty editor.
      const prompt = page.locator('.write-prompt');
      assert.ok(await prompt.isVisible(), `${tag}: prompt line on an empty editor`);
      assert.ok((await prompt.locator('.prompt-text').innerText()).trim().length > 0, `${tag}: a question is shown`);
      // "다른 질문" reaches 44px through ::after (critique 3 P2): the point 6px above its box still hits it.
      const ask = await page.locator('[data-action=help-write-inline]').boundingBox();
      assert.ok(ask.height < 44, `${tag}: drawn link stays small`);
      assert.equal(await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest('[data-action=help-write-inline]') !== null, [ask.x + ask.width / 2, ask.y - 5]), true, `${tag}: 44px hit area`);
      await page.locator('[data-action=help-write-inline]').click();
      await page.locator('[data-next-prompt]').waitFor();
      await page.keyboard.press('Escape');
      assert.equal(await editor.inputValue(), '', `${tag}: the question is never inserted into the draft`);
      await editor.fill('오늘');
      // Draft autosave speaks of 임시 보관, never of saving the record (critique 3 P2).
      await page.waitForFunction(() => document.querySelector('#save-status')?.textContent === '임시 보관됨');
      await page.waitForFunction(() => !document.querySelector('.write-prompt') || getComputedStyle(document.querySelector('.write-prompt')).display === 'none');

      // 2) Ctrl+Enter on an empty draft does not save; with text it saves and shows the quote.
      await editor.fill('');
      await editor.press('Control+Enter');
      await page.locator('#write-error').waitFor();
      assert.equal(await page.evaluate(() => DiaryReview.getState().sessions.length), 0, `${tag}: empty Ctrl+Enter saves nothing`);
      await editor.fill(TEXT);
      await editor.press('Control+Enter');
      await page.locator('#wait-title').waitFor();
      assert.equal(await page.evaluate(() => DiaryReview.getState().sessions.length), 1, `${tag}: Ctrl+Enter saved`);
      const quote = await page.locator('.wait-quote').innerText();
      assert.match(quote, /퇴근길에 노을이 예뻐서 한참 걸었다\./, `${tag}: first sentence given back`);
      assert.doesNotMatch(quote, /라면/, `${tag}: only the first sentence`);
      assert.match(quote, /\d+월 \d+일 .요일의 기록/, `${tag}: long date, not ISO`);
      assert.equal(await page.locator('.record-top [data-action=history]').isVisible(), false, `${tag}: one way back while waiting`);
      // Critique 3 P2: the panel says it once, without development wording.
      const waitText = await page.locator('.wait-panel').innerText();
      assert.doesNotMatch(waitText, /연결 전|AI 감정 분석/, `${tag}: no development wording`);
      assert.match(waitText, /봉인해 두었다가/, `${tag}: the sealed-card line`);
      assert.equal(await page.locator('.record-layout.is-waiting .card-area > .caption').isVisible(), false, `${tag}: no repeated caption under the card`);
      assert.equal(await page.locator('#feedback').isVisible(), false, `${tag}: no floating #feedback copy`);
      assert.match(await page.locator('.record-date').innerText(), /\d+월 \d+일 .요일/, `${tag}: card page date is the long form`);

      // 3) Done bar and streak.
      await page.locator('[data-wait-action=write]').click();
      await page.locator('.done-status').waitFor();
      assert.equal(await page.locator('.done-actions [data-open]').getAttribute('class'), 'secondary', `${tag}: pending "카드 보기" is secondary`);
      assert.equal(await page.locator('.streak-chip').count(), 0, `${tag}: no "1일 연속" on day one`);

      // 6) Critique 3 (2026-11-24): pending cards are sealed letters, phones carry today's card in the done bar,
      //    and the phone month view keeps the editor.
      assert.ok(await page.locator('.mini-card.is-sealed').count() >= 1, `${tag}: pending mini cards are sealed envelopes`);
      assert.equal(await page.locator('.mini-card.is-sealed .mc-q').count(), 0, `${tag}: no "?" on a sealed card`);
      const thumb = page.locator('.done-card');
      assert.equal(await thumb.isVisible(), mobile, `${tag}: today's card in the done bar on phones only`);
      if (mobile) {
        const box = await thumb.boundingBox();
        assert.ok(box.width >= 44 && box.height >= 44, `${tag}: thumbnail is a 44px target`);
        await thumb.click();
        await page.locator('#card-modal[open] .art-card[data-card-status="pending"]').waitFor();
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => !document.querySelector('#card-modal[open]'));
        assert.equal(await page.evaluate(() => document.activeElement?.classList.contains('done-card')), true, `${tag}: focus returns to the thumbnail`);
      }
      await page.locator('[data-write-calendar=month]').click();
      await page.locator('.month-cards').waitFor();
      assert.ok(await editor.isVisible(), `${tag}: the month view keeps the editor`);
      await page.locator('[data-write-calendar=week]').click();

      // 5) Phones: heading + one tile, 12px floor on the storage note and calendar labels.
      if (mobile) {
        // Critique 4: with only today's record the heading says what will appear (no orphan), and "전체 보기" stays.
        assert.equal(await page.locator('.recent-head h2').innerText(), '지난 기록', `${tag}: the row reads as the archive link, not the rail's heading`);
        assert.ok(await page.locator('[data-action=archive-records]').isVisible(), `${tag}: archive link stays`);
        // Critique 3: today's tile no longer repeats the editor, so the week rail clears the tab bar at rest.
        assert.equal(await page.locator('.recent-tile.is-today').isVisible(), false, `${tag}: no duplicate of today's record`);
        await page.evaluate(() => scrollTo(0, 0));
        const [railBox, tabsBox] = await page.evaluate(() => ['.week-rail', '.tabs'].map(s => document.querySelector(s).getBoundingClientRect().toJSON()));
        assert.ok(railBox.bottom <= tabsBox.top, `${tag}: week rail above the tab bar (${railBox.bottom} ≤ ${tabsBox.top})`);
        const tiles = await page.locator('.recent-list .recent-tile').evaluateAll(ts => ts.filter(t => getComputedStyle(t).display !== 'none').length);
        assert.ok(tiles <= 1, `${tag}: at most one recent tile`);
        const small = await page.evaluate(() => [...document.querySelectorAll('.write-main > #privacy, .streak-chip, .rail-day, .rail-date, .calendar-switch button, .tabs .tab')]
          .filter(el => el.offsetParent).map(el => parseFloat(getComputedStyle(el).fontSize)).filter(s => s < 12));
        assert.deepEqual(small, [], `${tag}: no meaningful text under 12px`);
        // Rail day cards reach 44px wide; future dates use --muted, not --subtle (critique 3 P2).
        const rail = await page.locator('.week-rail button.day-card').first().evaluate(el => { const r = el.getBoundingClientRect(), b = getComputedStyle(el, '::before'); return { w: r.width, before: b.content !== 'none' ? parseFloat(b.left) : null }; });
        assert.ok(rail.w >= 44 || (rail.before !== null && rail.w - 2 * rail.before >= 44 - 0.5), `${tag}: rail day card hit area ${JSON.stringify(rail)}`);
        const future = await page.evaluate(() => { const el = document.querySelector('.rail-date.is-future'); return el && [getComputedStyle(el).color, getComputedStyle(document.documentElement).getPropertyValue('--muted').trim()]; });
        if (future) assert.equal(future[0], await page.evaluate(c => { const s = document.createElement('span'); s.style.color = c; document.body.append(s); const v = getComputedStyle(s).color; s.remove(); return v; }, future[1]), `${tag}: future dates use --muted`);
      }

      // 4) Demo mode.
      await page.locator('header .avatar').click();
      await page.locator('#settings-records [data-action=preview]').click();
      await page.locator('#celebrate-dialog[open]').waitFor({ timeout: 3000 }).catch(() => {});
      await page.keyboard.press('Escape');
      const demo = await page.evaluate(() => {
        const s = DiaryReview.getState();
        return s.mode;
      });
      assert.equal(demo, 'example', `${tag}: demo mode on`);
      await page.locator('.tabs [data-action=write]').first().click();
      await editor.waitFor();
      assert.match(await page.locator('.example-note').innerText(), /실제 기록장에 저장/, `${tag}: demo editor note`);
      await editor.fill('시연 중에 쓴 글');
      assert.equal(await page.locator('.write-actions [data-action=save]').innerText(), '실제 기록으로 저장', `${tag}: demo save label`);
      await page.locator('[data-write-calendar=month]').click();
      const count = await page.locator('.month-count').evaluate(el => el.textContent);
      const n = Number((count.match(/기록 (\d+)편/) || [])[1]);
      assert.ok(n <= 30, `${tag}: demo month count ${n} within the 30-record limit`);

      assert.deepEqual(errors, [], `${tag}: no page errors`);
      await context.close();
      console.log(`ok ${tag}`);
    }
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exit(1); });

// 2026-11-24 critique 4 follow-up (Plain Node script, Playwright).
// 1) One pending vocabulary: "봉인" + "감정 읽기" — no "분석 대기" on the record, catalog, statistics or card modal.
// 2) Recent tiles show the record's own mini card (sealed while pending), no blurred orb.
// 3) Phones: the "최근 기록" heading never stands alone after today's save (a "지난 기록" link row, archive link kept); a first run shows the guide right under the editor.
// 4) Korean wraps between words (keep-all); the spring curve no longer overshoots; reduced motion stops the shimmer.
// 5) Demo mode: the editor says it is the real diary, the popup does not claim cards were "획득".
// 6) Night: sealed mini cards sit lower in light.
const assert = require('node:assert/strict'), path = require('node:path'), os = require('node:os');
const { pathToFileURL } = require('node:url');
const { executablePath, reveal } = require('./browser-runtime.cjs');
const { chromium } = require(process.env.CARDEX_PLAYWRIGHT || path.join(os.tmpdir(), 'aibootcamp-frontend-review/node_modules/playwright'));
const URL = process.env.CARDEX_TEST_URL || pathToFileURL(path.resolve(__dirname, '../index.html')).href;
const OLD = /분석 대기|분석을 기다|감정 분석이 끝나면/;

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
      const visibleText = () => page.evaluate(() => document.querySelector('#app').innerText);

      // 3b) First run on phones: the guide follows the editor, no empty recent tile in between.
      if (mobile) {
        assert.equal(await page.locator('.recent-empty').isVisible(), false, `${tag}: first run hides the empty recent tile`);
        assert.equal(await page.locator('.recent-head h2').innerText(), '지난 기록', `${tag}: first run keeps the archive link row`);
        const [head, guide] = await page.evaluate(() => ['.recent-head', '.write-side'].map(q => document.querySelector(q).getBoundingClientRect().bottom));
        assert.ok(guide - head < 900, `${tag}: guide follows the link row`);
        assert.ok(await page.locator('.write-side[data-first="true"]').isVisible(), `${tag}: first-run guide visible`);
      }
      // 4) keep-all on the workspace; a gentler spring.
      assert.equal(await page.locator('#diary-text').evaluate(el => getComputedStyle(el).wordBreak), 'keep-all', `${tag}: editor keeps words whole`);
      assert.equal(await page.locator('.recent-panel').evaluate(el => getComputedStyle(el).wordBreak), 'keep-all', `${tag}: page text keeps words whole`);
      const spring = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--spring').trim());
      const overshoot = Number(spring.match(/cubic-bezier\(([^)]+)\)/)[1].split(',')[1]);
      assert.ok(overshoot <= 1.2, `${tag}: spring overshoot ${spring}`);

      // Save one record and come back to the editor.
      await page.locator('#diary-text').fill('창밖에 첫눈이 내렸다. 따뜻한 차를 마셨다.');
      await reveal(page, 'save');
      await page.locator('.done-status').waitFor();

      // 1) Vocabulary on the record screen.
      assert.doesNotMatch(await visibleText(), OLD, `${tag}: record screen`);
      assert.match(await page.locator('.done-status').innerText(), /봉인/, `${tag}: done bar speaks of sealing`);
      // 2) Tile thumbnail = sealed mini card (phones hide today's tile after saving, so measure on desktop).
      assert.equal(await page.locator('.tile-orb').count(), 0, `${tag}: no orb thumbnail`);
      assert.equal(await page.locator('.recent-list .recent-tile').first().locator('.tile-card .mini-card.is-sealed').count(), 1, `${tag}: tile carries the sealed mini card`);
      if (!mobile) {
        const [t, c, s] = await page.evaluate(() => ['.recent-tile', '.recent-tile .tile-card', '.recent-tile > small'].map(q => document.querySelector(q).getBoundingClientRect().toJSON()));
        assert.ok(c.top >= t.top && c.bottom <= t.bottom, `${tag}: card inside the tile`);
        assert.ok(c.right <= s.left, `${tag}: card does not sit under the meta line`);
      }
      // 3) Phones: no orphan heading when today's record is the only one.
      // The panel stays ("전체 보기" is the archive's only door) and explains itself instead of showing a bare heading.
      assert.equal(await page.locator('.recent-head h2').innerText(), mobile ? '지난 기록' : '최근 기록', `${tag}: heading reads as an archive link row on phones`);
      assert.ok(await page.locator('[data-action=archive-records]').isVisible(), `${tag}: archive link stays`);

      // 1) Catalog, statistics and the card modal.
      await reveal(page, 'catalog');
      assert.doesNotMatch(await visibleText(), OLD, `${tag}: catalog`);
      assert.match(await page.locator('.collection-empty').innerText(), /봉인해 두었어요/);
      await reveal(page, 'review-month');
      assert.doesNotMatch(await visibleText(), OLD, `${tag}: statistics`);
      const labels = await page.locator('.weekday-bar').evaluateAll(xs => xs.map(x => x.getAttribute('aria-label')).join(' | '));
      assert.doesNotMatch(labels, OLD, `${tag}: weekday labels`);
      await page.locator('[data-action=write]').first().click();
      await page.locator('[data-card-day]:visible').first().click();
      await page.locator('#card-modal[open]').waitFor();
      assert.doesNotMatch(await page.locator('#card-modal').innerText(), OLD, `${tag}: card modal`);
      assert.match(await page.locator('#card-modal-title').innerText(), /봉인해 둔 카드/);
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('#card-modal[open]'));

      // 6) Night theme: sealed mini cards are dimmed.
      const prev = await page.evaluate(() => document.documentElement.dataset.theme);
      await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
      const filter = await page.locator('.mini-card.is-sealed').first().evaluate(el => getComputedStyle(el).filter);
      assert.match(filter, /brightness\(0?\.6/, `${tag}: night sealed card filter ${filter}`);
      await page.evaluate(t => { document.documentElement.dataset.theme = t; }, prev);

      // 4) Reduced motion stops the mystery back's shimmer (stylesheet rule).
      const shimmerStopped = await page.evaluate(() => [...document.styleSheets].some(sh => [...sh.cssRules].some(r => r.media && /reduce/.test(r.media.mediaText) && [...r.cssRules].some(x => /\.mystery-back::after/.test(x.selectorText || '') && x.style.animationName === 'none'))));
      assert.ok(shimmerStopped, `${tag}: reduced motion stops mystery-back shimmer`);

      // 5) Demo mode.
      await page.locator('header .avatar').click();
      await page.locator('#settings-records [data-action=preview]').click();
      const popup = page.locator('#celebrate-dialog[open]');
      if (await popup.waitFor({ timeout: 3000 }).then(() => true, () => false)) {
        assert.doesNotMatch(await popup.locator('h2').innerText(), /획득/, `${tag}: demo popup does not claim cards were earned`);
        await page.keyboard.press('Escape');
      }
      await page.locator('.tabs [data-action=write]').first().click();
      await page.locator('#diary-text').waitFor();
      const scope = page.locator('.editor-scope');
      assert.ok(await scope.isVisible(), `${tag}: demo editor scope line`);
      assert.match(await scope.innerText(), /내 기록장/);

      assert.deepEqual(errors, [], `${tag}: no page errors`);
      await context.close();
      console.log(`ok ${tag}`);
    }
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exit(1); });

// 2026-11-20 soft UI v1.1 collection: header progress, parent tabs, mini-card slots, empty state,
// detail with No./first date, growth row and records, phone bottom sheet. Plain Node script.
const assert = require('node:assert/strict'), path = require('node:path'), os = require('node:os');
const { pathToFileURL } = require('node:url');
const { executablePath, reveal } = require('./browser-runtime.cjs');
const { chromium } = require(process.env.CARDEX_PLAYWRIGHT || path.join(os.tmpdir(), 'aibootcamp-frontend-review/node_modules/playwright'));
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath });
  try {
    for (const [width, height] of [[1440, 900], [320, 568]]) {
      const page = await browser.newPage({ viewport: { width, height } });
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
      await page.waitForFunction(() => DiaryReview.isReady());

      // First run: everything locked, guidance shown, 0 / 27.
      await reveal(page, 'catalog');
      assert.equal(await page.locator('.catalog-title').innerText(), '모은 마음 카드');
      // Figma "도감 · 첫 실행": no progress card, the locked grid fades under one call to action.
      assert.equal(await page.locator('.collect-card').count(), 0);
      assert.equal(await page.locator('.collection-empty [data-action=write]').innerText(), '첫 기록 남기기');
      assert.equal(await page.locator('.catalog-grid-wrap').evaluate(el => el.inert), true, 'faded grid is not focusable');
      assert.equal(await page.locator('.slot.is-locked .mini-card.is-locked').count(), 27);
      assert.match(await page.locator('.collection-empty').innerText(), /아직 모은 카드가 없어요/);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'no page overflow');

      // Example collection: tabs with counts narrow the board by parent.
      await reveal(page, 'settings'); await reveal(page, 'preview'); await reveal(page, 'catalog');
      assert.equal(await page.locator('.collection-empty').count(), 0);
      assert.match(await page.locator('.collect-card').innerText(), /27\s*\/ 27 수집/);
      assert.equal(await page.locator('.slot > strong, .slot > small').count(), 0, 'no captions under the cards (Figma)');
      assert.deepEqual(await page.locator('.catalog-tab').evaluateAll(xs => xs.map(x => x.innerText.replace(/\s+/g, ' ').trim())), ['전체 27', '긍정 9', '부정 9', '중립 9']);
      assert.equal(await page.locator('.catalog-tab[aria-selected=true]').getAttribute('data-catalog-parent'), 'all');
      await page.locator('[data-catalog-parent=negative]').click();
      assert.equal(await page.locator('[data-catalog-parent=negative]').evaluate(el => el === document.activeElement), true);
      assert.equal(await page.locator('.slot[data-stage]').count(), 9);
      assert.deepEqual([...new Set(await page.locator('.slot').evaluateAll(xs => xs.map(x => x.dataset.slotType)))], ['neg_1', 'neg_2', 'neg_3']);
      // An emotion chip selects one emotion (3 slots) and clears the parent tab highlight.
      await page.locator('[data-catalog-filter=neg_2]').click();
      assert.equal(await page.locator('.slot[data-stage]').count(), 3);
      assert.equal(await page.locator('.catalog-tab[aria-selected=true]').count(), 0);
      await page.locator('[data-catalog-filter=all]').click();
      assert.equal(await page.locator('.slot[data-stage]').count(), 27);
      if (width >= 960) {
        const cols = await page.locator('.collection-grid').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length);
        assert.equal(cols, 6, 'six columns on desktop');
      }
      // Collected slots show the best record's mini card with the collection number.
      const slot = page.locator('.slot[data-slot-type=pos_2][data-stage="2"]');
      assert.equal(await slot.locator('.mini-card[data-type=pos_2][data-stage="2"]').count(), 1);
      assert.equal(await slot.locator('.mc-band em').innerText(), 'No.005');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'no page overflow (example)');

      // Detail: No. and first date, best probability, growth row with the current stage, records, share.
      await slot.click();
      const detail = page.locator('#card-detail[open]');
      await detail.waitFor();
      assert.match(await detail.locator('.detail-no').innerText(), /^No\.005 · \d{4}\.\d{2}\.\d{2} 획득$/);
      assert.match(await detail.locator('#card-detail-title').textContent(), /^만족·감사 · 2단계$/, 'the stage stays in the accessible title');
      assert.equal(await detail.locator('#card-detail-title').evaluate(el => el.firstChild.textContent), '만족·감사', 'visible title is the emotion name (Figma)');
      assert.match(await detail.locator('.detail-meta').innerText(), /최고 확률 \d+% · 임시 분류/);
      assert.deepEqual(await detail.locator('.growth-row li').evaluateAll(xs => xs.map(x => x.dataset.growth)), ['got', 'now', 'got']);
      assert.equal(await detail.locator('.growth-row [aria-current=true]').innerText().then(t => t.replace(/\s+/g, ' ').trim()), '2단계 지금');
      assert.ok(!(await detail.innerText()).includes('번 더 기록'), 'no count-based growth copy');
      assert.match(await detail.locator('.growth-hint').innerText(), /3단계까지 모두 모았어요|최고 확률이 .+ 기록이 생기면 \d단계 카드가 열려요/);
      assert.equal(await detail.locator('.detail-card .art-card[viewBox="0 0 1080 1512"]').count(), 1);
      assert.ok(await detail.locator('.detail-records [data-open]').count() >= 1);
      assert.equal(await detail.locator('[data-share-record]').count(), 1);
      if (width < 960) {
        const box = await detail.boundingBox();
        assert.ok(box.y <= 1 && Math.abs(box.height - height) <= 1, 'full-page detail on phones');
        assert.equal(await detail.locator('.detail-back').isVisible(), true, '← 도감 back link');
      }
      await page.keyboard.press('Escape');
      await page.locator('#card-detail').waitFor({ state: 'detached', timeout: 2000 });
      assert.deepEqual(errors, []);
      await page.close();
    }
    console.log('PASS: collection header, parent tabs, mini-card slots, empty state, detail growth row and records, no overflow at 320');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });

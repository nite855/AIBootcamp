// 2026-11-24 bundle B: a real writer whose records all wait for analysis. The catalog and statistics
// say why they are empty (never "write more"), the catalog offers the demo binder in place, the wait
// step stays still, sharing names what is copied and notices are marked "준비 중". Plain Node script.
const assert = require('node:assert/strict'), path = require('node:path'), os = require('node:os');
const { pathToFileURL } = require('node:url');
const { executablePath, reveal } = require('./browser-runtime.cjs');
const { chromium } = require(process.env.CARDEX_PLAYWRIGHT || path.join(os.tmpdir(), 'aibootcamp-frontend-review/node_modules/playwright'));
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath });
  try {
    for (const [width, height] of [[1440, 900], [390, 844], [320, 568]]) {
      const page = await browser.newPage({ viewport: { width, height } });
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.goto(process.env.CARDEX_TEST_URL || pathToFileURL(path.resolve(__dirname, '../index.html')).href);
      await page.waitForFunction(() => DiaryReview.isReady());
      const noOverflow = async label => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${width}: ${label} has no page overflow`);

      // First run: the catalog explains the analysis step and offers the demo binder next to "첫 기록 남기기".
      await reveal(page, 'catalog');
      const first = page.locator('.collection-empty');
      assert.equal(await first.getAttribute('data-empty'), 'first');
      assert.match(await first.innerText(), /AI 감정 분석은 아직 연결 전이에요/);
      assert.equal(await first.locator('[data-action=write]').count(), 1);
      assert.equal(await first.locator('[data-action=preview-catalog]').innerText(), '시연 모드로 미리 보기');
      assert.ok((await first.locator('[data-action=preview-catalog]').boundingBox()).height >= 44, 'demo button is a 44px target');

      // Save a real record: the wait step is labelled "대기" and nothing in it animates.
      await page.locator('[data-action=write]').first().click();
      await page.locator('#diary-text').fill('분석 대기 화면 점검 PRIVATE_PENDING_TEXT');
      await reveal(page, 'save', { stay: true });
      const wait = page.locator('.wait-panel');
      await wait.waitFor();
      assert.match(await wait.locator('[aria-current=step]').innerText(), /^감정 읽기\s*대기$/);
      assert.equal(await wait.evaluate(el => el.getAnimations({ subtree: true }).length), 0, 'the wait panel does not pulse');

      // Catalog with saved-but-waiting records: the count, no write call to action, the demo button stays on the catalog.
      await page.locator('[data-wait-action=catalog]').click();
      const waiting = page.locator('.collection-empty');
      await waiting.waitFor();
      assert.equal(await waiting.getAttribute('data-empty'), 'waiting');
      assert.match(await waiting.innerText(), /카드가 분석을 기다리고 있어요/);
      assert.match(await waiting.innerText(), /기록 1편은 잘 저장됐어요/);
      assert.equal(await waiting.locator('[data-action=write]').count(), 0, 'no "write more" promise');
      await noOverflow('waiting catalog');

      // Statistics: one page-level 분석 대기 banner; the weekday label says 분석 대기 for recorded days.
      await reveal(page, 'review-month');
      const banner = page.locator('.stats-wait-banner');
      assert.equal(await banner.count(), 1);
      assert.match(await banner.innerText(), /이번 달 기록 1편은 잘 저장됐어요/);
      assert.equal(await banner.locator('[data-action=preview]').count(), 1);
      const labels = await page.locator('.weekday-bar').evaluateAll(xs => xs.map(x => x.getAttribute('aria-label')));
      assert.ok(labels.some(l => /분석 대기, 1편/.test(l)) && labels.some(l => /기록 없음, 0편/.test(l)), labels.join(' | '));
      assert.ok(labels.every(l => !/분석 없음/.test(l)));
      await noOverflow('waiting statistics');

      // The demo button on the catalog switches modes in place; statistics then shows no banner.
      await reveal(page, 'catalog');
      await page.locator('[data-action=preview-catalog]').click();
      const popup = page.locator('#celebrate-dialog[open]');
      if (await popup.waitFor({ timeout: 1000 }).then(() => true, () => false)) await popup.locator('.celebrate-close').click();
      assert.deepEqual(await page.evaluate(() => { const s = DiaryReview.getState(); return [s.mode, s.view, s.archiveTab]; }), ['example', 'history', 'catalog']);
      assert.equal(await page.locator('.collection-empty').count(), 0);
      assert.equal(await page.locator('.collect-card').count(), 1);
      await reveal(page, 'review-month');
      assert.equal(await page.locator('.stats-wait-banner').count(), 0, 'analyzed demo months have no banner');

      // Share: the copy button names the app address and explains what the receiver sees.
      await reveal(page, 'catalog');
      await page.locator('.slot:not(.is-locked) .mini-card').first().click();
      await page.locator('#card-detail[open] [data-share-record]').click();
      const link = page.locator('[data-action=share-link]');
      assert.equal(await link.innerText(), '앱 주소 복사');
      assert.match(await page.locator('#' + await link.getAttribute('aria-describedby')).innerText(), /받는 사람에게 내 카드나 기록은 보이지 않아요/);
      await noOverflow('share page');

      // Notices: both switches carry a visible "준비 중" badge.
      await reveal(page, 'settings');
      assert.deepEqual(await page.locator('.notice-row .soon-badge').allInnerTexts(), ['준비 중', '준비 중']);
      await noOverflow('profile');
      assert.deepEqual(errors, []);
      await page.close();
    }
    console.log('PASS: pending catalog/statistics copy, demo binder in place, still wait step, app-address copy, notices marked 준비 중 (1440·390·320px)');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });

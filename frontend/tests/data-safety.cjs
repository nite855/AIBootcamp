// 2026-11-24 bundle D data safety: the save label says what a save does (new / edit / replace today's
// record), replacing today's record from another draft is confirmed, the editor moves to the new day
// after midnight without silently turning yesterday's text into today's record, and "모든 기록 삭제"
// asks once with an irreversible warning. Plain Node script (Playwright clock for the date change).
const assert = require('node:assert/strict'), path = require('node:path'), os = require('node:os');
const { pathToFileURL } = require('node:url');
const { executablePath, reveal } = require('./browser-runtime.cjs');
const { chromium } = require(process.env.CARDEX_PLAYWRIGHT || path.join(os.tmpdir(), 'aibootcamp-frontend-review/node_modules/playwright'));
const URL = process.env.CARDEX_TEST_URL || pathToFileURL(path.resolve(__dirname, '../index.html')).href;
const DAY1 = new Date('2026-11-24T23:50:00'), DAY2 = new Date('2026-11-25T00:10:00');

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath });
  try {
    for (const [width, height] of [[1440, 900], [390, 844]]) {
      const mobile = width < 960;
      const context = await browser.newContext({ viewport: { width, height }, hasTouch: mobile, isMobile: mobile });
      const page = await context.newPage();
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.clock.install({ time: DAY1 });
      await page.goto(URL);
      await page.waitForFunction(() => DiaryReview.isReady());
      const st = () => page.evaluate(() => { const s = DiaryReview.getState(); return { date: s.date, text: s.text, sessions: s.sessions.map(r => [r.recordDate, r.text, r.version]), status: s.status }; });
      const label = () => page.locator('.write-actions [data-action=save]').innerText();
      const saved = () => page.waitForFunction(() => document.querySelector('#save-status')?.textContent === '초안 저장됨');
      const dialog = page.locator('#confirm-dialog[open]');

      // New record: "카드 받기" (phones drop "기록하고").
      await page.locator('#diary-text').fill('첫 번째 오늘 기록');
      assert.equal(await label(), mobile ? '카드 받기' : '기록하고 카드 받기');
      await reveal(page, 'save');
      assert.deepEqual((await st()).sessions, [['2026-11-24', '첫 번째 오늘 기록', 1]]);

      // Editing today's record: "저장하기", no dialog, "수정했어요".
      await page.locator('[data-write-edit]').click();
      await page.locator('#diary-text').press('End');
      await page.locator('#diary-text').pressSequentially(' 덧붙임');
      assert.equal(await label(), mobile ? '저장하기' : '수정한 내용 저장하기');
      await reveal(page, 'save');
      assert.equal(await dialog.count(), 0, 'an edit is not confirmed');
      assert.deepEqual((await st()).sessions, [['2026-11-24', '첫 번째 오늘 기록 덧붙임', 2]]);
      assert.match(await page.locator('#announcer').innerText(), /기록을 수정했어요/);

      // Another draft would replace today's record: "기록 바꾸기" and a dialog; cancel keeps it.
      await reveal(page, 'clear-draft'); await page.locator('[data-confirm=accept]').click();
      await page.waitForFunction(() => /초안을 지웠어요/.test(document.querySelector('#feedback')?.textContent));
      await page.locator('#diary-text').fill('완전히 다른 새 초안');
      assert.equal(await label(), mobile ? '기록 바꾸기' : '오늘 기록 바꾸기');
      await page.locator('.write-actions [data-action=save]').click();
      await dialog.waitFor();
      assert.equal(await dialog.locator('#confirm-title').innerText(), '오늘 기록 바꾸기');
      assert.match(await dialog.locator('#confirm-copy').innerText(), /첫 번째 오늘 기록 덧붙임.*되돌릴 수 없어요/s);
      assert.equal(await dialog.locator('[data-confirm=accept]').innerText(), '바꿔서 저장');
      await dialog.locator('[data-confirm=cancel]').click();
      assert.deepEqual((await st()).sessions, [['2026-11-24', '첫 번째 오늘 기록 덧붙임', 2]], 'cancel keeps today\'s record');
      assert.equal((await st()).text, '완전히 다른 새 초안', 'cancel keeps the draft');
      await page.locator('.write-actions [data-action=save]').click();
      await dialog.locator('[data-confirm=accept]').click();
      await page.waitForFunction(() => DiaryReview.getState().sessions[0].version === 3);
      assert.deepEqual((await st()).sessions, [['2026-11-24', '완전히 다른 새 초안', 3]]);
      assert.match(await page.locator('#announcer').innerText(), /오늘 기록을 지금 내용으로 바꿨어요/);
      await page.locator('.wait-panel').waitFor();
      await page.locator('[data-wait-action=write]').click();

      // Midnight, editor showing yesterday's saved record unchanged: returning clears it for the new day.
      await page.clock.setSystemTime(DAY2);
      await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      await page.waitForFunction(() => DiaryReview.getState().date === '2026-11-25');
      assert.equal((await st()).text, '');
      assert.match(await page.locator('#feedback').innerText(), /날짜가 바뀌었어요\. 지난 기록은 저장돼 있고/);
      assert.equal(await label(), mobile ? '카드 받기' : '기록하고 카드 받기');

      // Midnight with unsaved text, no focus event: the first save stops with a notice, the second saves on the new day.
      await page.locator('#diary-text').fill('자정 직전에 쓰던 글');
      await saved();
      const DAY3 = new Date('2026-11-26T00:05:00');
      await page.clock.setSystemTime(DAY3);
      await page.locator('.write-actions [data-action=save]').click();
      await page.waitForFunction(() => DiaryReview.getState().date === '2026-11-26');
      assert.equal((await st()).sessions.length, 1, 'the first press only explains the date change');
      assert.equal((await st()).text, '자정 직전에 쓰던 글', 'unsaved text is kept');
      assert.match(await page.locator('#feedback').innerText(), /쓰던 내용은 11월 26일.* 기록으로 저장돼요/);
      await reveal(page, 'save');
      assert.deepEqual((await st()).sessions.map(r => r[0]), ['2026-11-24', '2026-11-26']);

      // Reload on a later day: a restored copy of an earlier record opens a new day's editor.
      await page.reload();
      await page.waitForFunction(() => DiaryReview.isReady());
      await page.clock.setSystemTime(new Date('2026-11-27T09:00:00'));
      await page.reload();
      await page.waitForFunction(() => DiaryReview.isReady() && DiaryReview.getState().date === '2026-11-27');
      assert.equal((await st()).text, '');

      // 모든 기록 삭제: one dialog with the count and an irreversible warning.
      await reveal(page, 'settings');
      assert.equal(await page.locator('[data-action=delete-all]').getAttribute('aria-haspopup'), 'dialog');
      await page.locator('[data-action=delete-all]').click();
      await dialog.waitFor();
      assert.equal(await dialog.locator('#confirm-title').innerText(), '모든 기록 삭제');
      assert.match(await dialog.locator('#confirm-copy').innerText(), /실제 기록 2편과 작성 중인 초안을 모두 삭제해요\. 되돌릴 수 없어요/);
      assert.equal(await dialog.locator('[data-confirm=accept]').innerText(), '모두 삭제');
      await dialog.locator('[data-confirm=accept]').click();
      await page.waitForFunction(() => DiaryReview.getState().sessions.length === 0);
      assert.equal(await dialog.count(), 0, 'no second press');
      assert.match(await page.locator('#feedback').innerText(), /모든 기록과 초안을 삭제했어요/);
      assert.deepEqual(errors, []);
      await context.close();
    }
    console.log('PASS: save label new/edit/replace, replace confirmed (cancel keeps both), midnight rollover (focus, save press, reload), delete-all single irreversible dialog (1440·390px)');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });

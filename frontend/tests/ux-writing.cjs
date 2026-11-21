// Writing aids: rotating prompt (never inserted into the draft) and 30-record limit guidance.
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

      // Prompt: today's question, "다른 질문" rotates, draft untouched, other info dialogs hide the button.
      await page.locator('#diary-text').fill('내 초안');
      await reveal(page, 'help-write');
      const copy = page.locator('#info-copy'), next = page.locator('[data-next-prompt]');
      const today = await page.evaluate(() => DiaryReview.localDate());
      const expected = await page.evaluate(d => DiaryCore.writingPrompt(d), today);
      assert.ok((await copy.innerText()).startsWith(expected));
      assert.equal(await next.isVisible(), true);
      await next.click();
      const second = await page.evaluate(d => DiaryCore.writingPrompt(d, 1), today);
      assert.ok((await copy.innerText()).startsWith(second));
      assert.notEqual(second, expected);
      assert.equal(await next.evaluate(el => el === document.activeElement), true, 'focus stays on the button');
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#diary-text').inputValue(), '내 초안', 'prompt never edits the draft');

      // Limit guidance: seed N real records into the stored snapshot, then reload so the app validates and restores them.
      assert.ok((await page.locator('#privacy').innerText()).includes('최대 30편'));
      await page.waitForFunction(() => document.querySelector('#save-status')?.textContent === '초안 저장됨');
      for (const [n, text, level] of [[24, '최대 30편', null], [25, '5편 남았어요', 'near'], [29, '1편 남았어요', 'near'], [30, '보관 한도 30편에 도달했어요', 'full']]) {
        await page.evaluate(n => new Promise((resolve, reject) => {
          const now = new Date().toISOString();
          const seed = Array.from({ length: n }, (_, i) => ({ id: 'seed-' + i, text: '가상 기록 ' + i, recordDate: '2026-10-' + String(1 + (i % 28)).padStart(2, '0'),
            version: 1, createdAt: now, updatedAt: now, favorite: false, analysis: { status: 'pending' } }));
          const open = indexedDB.open('moment-diary-main', 1);
          open.onsuccess = () => {
            const db = open.result, tx = db.transaction('data', 'readwrite'), store = tx.objectStore('data'), read = store.get('state');
            read.onsuccess = () => { const v = read.result; v.sessions = seed; v.currentEntryId = null; v.revision++; store.put(v, 'state'); };
            tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error);
          };
          open.onerror = () => reject(open.error);
        }), n);
        await page.reload(); await page.waitForFunction(() => DiaryReview.isReady());
        const note = page.locator('#privacy');
        assert.ok((await note.innerText()).includes(text), `${n}: ${await note.innerText()}`);
        assert.equal(await note.getAttribute('data-level'), level);
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      // Full: the shortcut opens settings › 데이터 관리 with focus on its summary.
      await page.locator('[data-action=backup-manage]').click();
      await page.waitForFunction(() => DiaryReview.getState().view === 'settings');
      const details = page.locator('.backup-panel').locator('xpath=ancestor::details[1]');
      assert.equal(await details.evaluate(el => el.open), true);
      assert.equal(await details.locator('summary').evaluate(el => el === document.activeElement), true);
      // Example mode never shows the real-record warning.
      await reveal(page, 'preview');
      await reveal(page, 'write');
      assert.equal(await page.locator('#privacy').getAttribute('data-level'), null);

      assert.deepEqual(errors, []);
      await page.close();
    }
    console.log('PASS: writing prompt rotation without editing draft, 25/29/30 limit guidance, backup shortcut, desktop/mobile');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

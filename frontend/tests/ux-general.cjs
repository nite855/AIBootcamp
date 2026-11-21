// General usability: first-run guide, origin-aware back button, delete undo (restore, persistence, guards, timing pause).
const assert = require('node:assert/strict'), path = require('node:path'), { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.CARDEX_PLAYWRIGHT || path.join(require('node:os').tmpdir(), 'aibootcamp-frontend-review/node_modules/playwright'));
const { executablePath, reveal } = require('./browser-runtime.cjs');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const ready = () => page.waitForFunction(() => DiaryReview.isReady());
    const saved = () => page.waitForFunction(() => document.querySelector('#save-status')?.textContent === '초안 저장됨');
    // Views without the editor have no save status, so read the stored snapshot directly.
    const storedCount = n => page.waitForFunction(n => new Promise(resolve => {
      const open = indexedDB.open('moment-diary-main', 1);
      open.onsuccess = () => { const db = open.result, read = db.transaction('data').objectStore('data').get('state');
        read.onsuccess = () => { db.close(); resolve(read.result?.sessions?.length === n); }; read.onerror = () => resolve(false); };
      open.onerror = () => resolve(false);
    }), n);
    await page.goto(process.env.CARDEX_TEST_URL || pathToFileURL(path.resolve(__dirname, '../index.html')).href);
    await ready();

    // First-run guide: explains record → model analysis → cards, disappears after the first record.
    const guide = page.locator('.first-run li');
    assert.equal(await guide.count(), 3);
    assert.ok((await guide.nth(1).innerText()).includes('감정 분석 모델'));
    assert.ok((await page.locator('.latest-panel').innerText()).includes('감정의 강도가 아니에요'));
    await page.locator('#diary-text').fill('첫 번째 기록');
    await reveal(page, 'save');
    await page.waitForFunction(() => DiaryReview.getState().sessions.length === 1);
    await saved();
    assert.equal(await page.locator('.first-run').count(), 0);

    // Back button: opened from home → "홈으로" returns home; opened from the archive → "목록으로".
    await page.locator('.recent-list [data-open]').first().click();
    const back = page.locator('.record-panel [data-action=history]');
    assert.equal(await back.innerText(), '홈으로');
    await back.click();
    assert.equal(await page.evaluate(() => DiaryReview.getState().view), 'write');
    await reveal(page, 'archive-records');
    await page.locator('.archive-panel [data-open]').first().click();
    assert.equal(await page.locator('.record-panel [data-action=history]').innerText(), '목록으로');
    await page.locator('.record-panel [data-action=history]').click();
    assert.equal(await page.evaluate(() => DiaryReview.getState().view), 'history');

    // Delete → toast → undo restores the same id/version and persists across reload.
    const before = await page.evaluate(() => DiaryReview.getState().sessions[0]);
    await page.locator('.archive-panel [data-open]').first().click();
    await reveal(page, 'delete-example');
    await page.locator('#confirm-dialog [data-confirm=accept]').click();
    await page.waitForFunction(() => DiaryReview.getState().sessions.length === 0);
    await storedCount(0);
    const toast = page.locator('#toast');
    assert.equal(await toast.isVisible(), true);
    assert.equal(await toast.getAttribute('role'), 'status');
    assert.equal(await page.evaluate(() => DiaryReview.getState().view), 'history', 'returns to the archive it came from');
    assert.equal(await page.locator('#feedback').innerText(), '기록을 삭제했어요.', 'delete never reads as saved');
    await page.locator('[data-toast-undo]').click();
    await page.waitForFunction(() => DiaryReview.getState().sessions.length === 1);
    await storedCount(1);
    assert.equal(await toast.isVisible(), false);
    assert.deepEqual(await page.evaluate(() => DiaryReview.getState().sessions[0]), before, 'same id, version and text');
    assert.ok((await page.locator('#announcer').innerText()).includes('되돌렸어요'));
    await page.reload(); await ready();
    assert.equal(await page.evaluate(() => DiaryReview.getState().sessions.length), 1, 'undo persisted');

    // Without undo the deletion stays; the toast hides after its timeout, and pauses while hovered.
    await page.clock.install();
    await reveal(page, 'archive-records');
    await page.locator('.archive-panel [data-open]').first().click();
    await reveal(page, 'delete-example');
    await page.locator('#confirm-dialog [data-confirm=accept]').click();
    await page.waitForFunction(() => DiaryReview.getState().sessions.length === 0);
    await toast.hover();
    await page.clock.runFor(10000);
    assert.equal(await toast.isVisible(), true, 'hover pauses the timer');
    await page.mouse.move(0, 0);
    await page.clock.runFor(8100);
    assert.equal(await toast.isVisible(), false);
    await storedCount(0);
    await page.reload(); await ready();
    assert.equal(await page.evaluate(() => DiaryReview.getState().sessions.length), 0, 'deletion persisted');

    // Switching to example mode hides a pending undo so it never restores into the wrong mode.
    await page.locator('#diary-text').fill('예시 전환 전 기록');
    await reveal(page, 'save');
    await page.waitForFunction(() => DiaryReview.getState().sessions.length === 1);
    await page.locator('.recent-list [data-open]').first().click();
    await reveal(page, 'delete-example');
    await page.locator('#confirm-dialog [data-confirm=accept]').click();
    await page.waitForFunction(() => DiaryReview.getState().sessions.length === 0);
    assert.equal(await page.evaluate(() => DiaryReview.getState().view), 'write', 'opened from home → back home');
    assert.equal(await toast.isVisible(), true);
    await reveal(page, 'settings');
    await reveal(page, 'preview');
    assert.equal(await toast.isVisible(), false);

    // Mobile: toast fits the viewport.
    await page.setViewportSize({ width: 360, height: 640 });
    await page.evaluate(() => { document.getElementById('toast').hidden = false; });
    const box = await toast.boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= 360, JSON.stringify(box));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);

    assert.deepEqual(errors, []);
    console.log('PASS: first-run guide, origin-aware back, delete undo/persist/timeout pause/mode guard, mobile toast');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

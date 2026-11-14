const {reveal} = require('./browser-runtime.cjs');
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.CARDEX_PLAYWRIGHT || path.join(os.tmpdir(), 'aibootcamp-frontend-review/node_modules/playwright'));
const url = pathToFileURL(path.resolve(__dirname, '../index.html')).href;
const click = (p, name) => reveal(p,name);
const ready = p => p.waitForFunction(() => window.DiaryReview?.isReady());
const stored = p => p.evaluate(async () => {
  const db = await new Promise((resolve, reject) => {
    const r = indexedDB.open('moment-diary-main', 1); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
  });
  try { return await new Promise((resolve, reject) => {
    const tx = db.transaction('data', 'readonly'), r = tx.objectStore('data').get('state');
    tx.oncomplete = () => resolve(r.result); tx.onabort = () => reject(tx.error);
  }); } finally { db.close(); }
});
const waitSaved = p => p.waitForFunction(() => document.querySelector('#save-status')?.textContent === '초안 저장됨');

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: require('./browser-runtime.cjs').executablePath });
  const errors = [];
  let contexts = [];
  async function page(options = {}) {
    const context = await browser.newContext({ offline: true, ...options }); contexts.push(context);
    const p = await context.newPage(); p.on('pageerror', e => errors.push(e.message));
    await p.goto(url); await ready(p); return p;
  }
  try {
    const p = await page();
    assert.equal(await p.getAttribute('html', 'data-appearance'), 'lemon');
    assert.equal(await p.getAttribute('html', 'data-theme'), 'light');
    await p.locator('#diary-text').fill('자동 저장 초안'); await waitSaved(p);
    await p.reload(); await ready(p);
    assert.equal(await p.locator('#diary-text').inputValue(), '자동 저장 초안');
    await click(p, 'save'); await waitSaved(p);
    assert.equal((await stored(p)).sessions.length, 1);
    await p.reload(); await ready(p);
    assert.equal(await p.evaluate(() => DiaryReview.getState().sessions.length), 1);
    await click(p, 'archive-records'); await p.locator('[data-open]').first().click();
    await click(p, 'edit-example'); await p.locator('#sample-text').fill('수정한 실제 기록');
    await click(p, 'save-example');
    await p.waitForFunction(() => !DiaryReview.getState().editing);
    assert.equal((await stored(p)).sessions[0].version, 2);
    assert.equal((await stored(p)).text, '수정한 실제 기록');
    await click(p, 'read-full');
    assert.equal(await p.locator('dialog .full-text').textContent(), '수정한 실제 기록');
    await p.keyboard.press('Escape');
    assert.equal(await p.evaluate(() => document.activeElement.getAttribute('data-action')), 'read-full');
    await click(p, 'delete-example'); await p.locator('[data-confirm=accept]').click();
    await p.waitForFunction(() => DiaryReview.getState().sessions.length === 0);
    assert.equal((await stored(p)).currentEntryId, null);

    // A write error must leave the memory draft intact; the next write must retry normally.
    await click(p, 'write');
    await p.evaluate(() => {
      const original = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function (...args) {
        IDBObjectStore.prototype.put = original;
        throw new DOMException('검증용 저장 용량 초과', 'QuotaExceededError');
      };
    });
    await p.locator('#diary-text').fill('저장 실패 후 보존할 초안');
    await p.waitForFunction(() => DiaryReview.getState().error);
    assert.equal(await p.locator('#diary-text').inputValue(), '저장 실패 후 보존할 초안');
    await click(p, 'retry-save'); await waitSaved(p);
    assert.equal((await stored(p)).text, '저장 실패 후 보존할 초안');
    // Serialized writes must retain the latest generation even if a second input arrives in flight.
    await p.locator('#diary-text').fill('첫 번째 변경');
    await p.locator('#diary-text').fill('가장 최근 변경'); await waitSaved(p);
    assert.equal((await stored(p)).text, '가장 최근 변경');
    await click(p, 'settings'); await p.locator('details').filter({has:p.locator('[name=policy]')}).evaluate(el=>el.open=true); await p.locator('[name=policy][value=multi]').check();
    await click(p, 'write'); await p.locator('#diary-text').fill('여러 편 첫 기록');
    await click(p, 'save'); await waitSaved(p); await click(p, 'write'); await click(p, 'new-entry'); await waitSaved(p);
    await p.locator('#diary-text').fill('여러 편 두 번째 기록'); await click(p, 'save'); await waitSaved(p);
    await p.reload(); await ready(p);
    assert.equal(await p.evaluate(() => DiaryReview.getState().policy), 'multi');
    assert.equal((await stored(p)).sessions.length, 2);
    await click(p, 'clear-draft'); await p.locator('[data-confirm=accept]').click(); await waitSaved(p);
    assert.equal((await stored(p)).text, '');
    assert.equal((await stored(p)).sessions.length, 2);
    await click(p, 'settings'); await click(p, 'delete-all');
    assert.equal((await stored(p)).sessions.length, 2);
    await p.locator('[data-confirm=accept]').click();
    await p.waitForFunction(() => DiaryReview.getState().sessions.length === 0);
    assert.equal((await stored(p)).sessions.length, 0);

    // Two clients that loaded the same revision must not overwrite one another.
    await click(p, 'write');
    const other = await p.context().newPage(); other.on('pageerror', e => errors.push(e.message));
    await other.goto(url); await ready(other);
    await other.locator('#diary-text').fill('다른 탭에서 저장한 기록'); await waitSaved(other);
    await p.locator('#diary-text').fill('충돌한 탭의 원문');
    await p.waitForFunction(() => DiaryReview.getState().status.includes('다른 탭'));
    assert.equal(await p.locator('#diary-text').inputValue(), '충돌한 탭의 원문');
    assert.equal((await stored(p)).text, '다른 탭에서 저장한 기록');

    // Corrupt data must remain untouched, including after retry.
    const corrupt = await page();
    await corrupt.evaluate(async () => {
      const db = await new Promise(resolve => { const r = indexedDB.open('moment-diary-main', 1); r.onsuccess = () => resolve(r.result); });
      await new Promise(resolve => { const tx = db.transaction('data', 'readwrite'); tx.objectStore('data').put({ schemaVersion: 99, sentinel: 'KEEP' }, 'state'); tx.oncomplete = resolve; });
      db.close();
    });
    await corrupt.reload(); await ready(corrupt);
    await corrupt.locator('#diary-text').fill('메모리에서 계속 작성'); await click(corrupt, 'retry-save');
    assert.equal((await stored(corrupt)).sentinel, 'KEEP');
    assert.equal(await corrupt.locator('#diary-text').inputValue(), '메모리에서 계속 작성');
    const blocked = await browser.newContext(); contexts.push(blocked);
    await blocked.addInitScript(() => { Object.defineProperty(window, 'indexedDB', { get() { throw Error('blocked'); } }); });
    const bp = await blocked.newPage(); await bp.goto(url); await ready(bp);
    await bp.locator('#diary-text').fill('저장소 없는 기록'); await click(bp, 'save');
    assert.equal(await bp.evaluate(() => DiaryReview.getState().sessions.length), 1);
    assert.equal(await bp.evaluate(() => DiaryReview.getState().error), true);

    // Safe enlarged text, real touch tap/hold, scrolling and keyboard interaction.
    const touch = await page({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
    const content = '<img src=x onerror=alert(1)>\n' + '긴 기록을 읽습니다.\n'.repeat(300);
    await touch.locator('#diary-text').fill(content); await click(touch, 'save');
    await touch.locator('.recent-list [data-open]').first().click();
    await click(touch, 'read-full');
    assert.equal(await touch.locator('.full-text').textContent(), content.trim());
    assert.equal(await touch.locator('.full-text img').count(), 0);
    await touch.locator('#read-full-dialog button').click();
    const scene = touch.locator('.flip-scene'), front = touch.locator('.flip-trigger');
    await front.tap(); assert.equal(await scene.evaluate(e => e.classList.contains('flipped')), true);
    await touch.locator('.flip-back').focus(); await touch.keyboard.press('Enter');
    await touch.waitForTimeout(650);
    const box = await front.boundingBox(), client = await touch.context().newCDPSession(touch);
    const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
    await touch.waitForTimeout(550);
    assert.equal(await touch.locator('.tilt-layer').evaluate(e => e.style.getPropertyValue('--shine')), '1');
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    assert.equal(await scene.evaluate(e => e.classList.contains('flipped')), false);
    // Touch cancellation clears both effects and the pending long-press timer.
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: point.x + 20, y: point.y - 20 }] });
    await touch.waitForFunction(() => document.querySelector('.tilt-layer').style.getPropertyValue('--shine') === '1', null, { timeout: 400 });
    await client.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    await touch.waitForTimeout(550);
    assert.deepEqual(await touch.locator('.tilt-layer').evaluate(el => ['--shine', '--tilt-x', '--tilt-y'].map(k => el.style.getPropertyValue(k))), ['0', '0deg', '0deg']);
    assert.equal(await scene.evaluate(e => e.classList.contains('flipped')), false);
    await front.tap(); await touch.waitForFunction(() => document.querySelector('.flip-scene').classList.contains('flipped')); await touch.waitForTimeout(650);
    // Body gestures do not light or tilt the card, and selected text does not flip it.
    await touch.locator('.flip-text').dispatchEvent('pointerdown', { pointerType: 'touch', isPrimary: true, pointerId: 8, clientX: 100, clientY: 200, bubbles: true });
    await touch.locator('.flip-text').dispatchEvent('pointermove', { pointerType: 'touch', pointerId: 8, clientX: 100, clientY: 250, bubbles: true });
    assert.equal(await touch.locator('.tilt-layer').evaluate(el => el.style.getPropertyValue('--shine')), '0');
    await scene.dispatchEvent('pointerup', { pointerType: 'touch', pointerId: 8, bubbles: true });
    await touch.locator('.flip-text').evaluate(el => { const range = document.createRange(); range.selectNodeContents(el); const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range); });
    await touch.locator('.flip-text').dispatchEvent('click', { detail: 1, bubbles: true });
    assert.equal(await scene.evaluate(e => e.classList.contains('flipped')), true);
    await touch.evaluate(() => getSelection().removeAllRanges());
    const bodyBox = await touch.locator('.flip-text').boundingBox();
    const bodyPoint = { x: bodyBox.x + bodyBox.width / 2, y: bodyBox.y + bodyBox.height * .8 };
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [bodyPoint] });
    for (let step = 1; step <= 5; step++) {
      await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: bodyPoint.x, y: bodyPoint.y - step * 12 }] });
    }
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await touch.waitForFunction(() => document.querySelector('.flip-text').scrollTop > 0);
    assert.equal(await scene.evaluate(e => e.classList.contains('flipped')), true, 'native body scrolling does not flip');
    await scene.dispatchEvent('pointerdown', { pointerType: 'touch', isPrimary: true, pointerId: 9, clientX: 100, clientY: 200, bubbles: true });
    await touch.locator('.flip-text').evaluate(e => { e.scrollTop = 200; });
    await scene.dispatchEvent('pointerup', { pointerType: 'touch', pointerId: 9, bubbles: true });
    await touch.locator('.flip-text').dispatchEvent('click', { detail: 1, bubbles: true });
    assert.equal(await scene.evaluate(e => e.classList.contains('flipped')), true);
    await touch.emulateMedia({ reducedMotion: 'reduce' });
    await touch.evaluate(() => CardexTheme.setMotion('off'));
    assert.equal(await touch.locator('.flip-light').first().evaluate(e => getComputedStyle(e).display), 'none');

    // Every main taxonomy ID resolves to the intended bundled 3D image and retains stage/probability.
    await click(touch, 'settings'); await click(touch, 'preview');
    const names = { neg_1: '불안', neg_2: '슬픔', neg_3: '분노' };
    for (const index of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 21]) {
      if (index > 1) await click(touch, 'archive-records');
      const targetPage = Math.floor(index / 6);
      while (await touch.evaluate(() => DiaryReview.getState().page) < targetPage) await click(touch, 'next');
      await touch.locator(`[data-open="sample-${index}"]`).click();
      const type = await touch.evaluate(() => {
        const s = DiaryReview.getState(); return CardexCore.IDS[(Number(s.selected.split('-')[1]) - 1) % CardexCore.IDS.length];
      });
      const expected = fs.readFileSync(path.resolve(__dirname, `../assets/characters/${type.startsWith('neu_') ? 'neutral' : type}.png`)).toString('base64');
      assert.equal(await touch.locator('.art-card image').getAttribute('href'), 'data:image/png;base64,' + expected);
      const text = await touch.locator('.art-card').textContent();
      assert.ok(text.includes(index === 21 ? '3단계' : index === 11 ? '2단계' : '1단계')); assert.ok(text.includes(index === 21 ? '95%' : index === 11 ? '75%' : '45%'));
      assert.equal(await touch.locator('[data-emotion-mark]').count(), type.startsWith('neu_') ? 1 : 0);
      if (names[type]) assert.ok(text.includes(names[type]));
    }
    await touch.screenshot({ path: path.join(os.tmpdir(), 'moment-lemon-mobile.png') });
    assert.deepEqual(errors, []);
    console.log('PASS: persistence, retry, deletion, conflict, corruption, blocked storage, dialog, touch/hold/scroll, 10 emotion artworks and three stages');
  } finally { for (const context of contexts) await context.close(); await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });

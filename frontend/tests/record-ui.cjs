const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.CARDEX_PLAYWRIGHT || path.join(os.tmpdir(), 'aibootcamp-frontend-review/node_modules/playwright'));

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CARDEX_CHROMIUM || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const output = fs.mkdtempSync(path.join(process.env.CARDEX_EVIDENCE || os.tmpdir(), 'verified-'));
  const errors = [];
  try {
    const context = await browser.newContext({ offline: true, acceptDownloads: true });
    const p = await context.newPage();
    p.on('pageerror', e => errors.push(e.message));
    await p.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
    await p.waitForFunction(() => DiaryReview.isReady());
    const click = action => require('./browser-runtime.cjs').reveal(p, action);
    const unseal = page => require('./browser-runtime.cjs').unseal(page);
    for (const [name, width, height] of [['desktop',1440,900], ['mobile',390,844], ['small',320,568]]) {
      await p.setViewportSize({ width, height });
      await p.waitForFunction(() => parseInt(document.documentElement.style.getPropertyValue('--app-height')) === innerHeight);
      assert.ok((await p.locator('#diary-text').boundingBox()).height >= 180);
      const save = await p.locator('[data-action=save]').boundingBox();
      assert.ok(save.y >= 0);
      if(width>=390) assert.ok(save.y + save.height <= height);
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await p.screenshot({ path: path.join(output, `write-${name}.png`) });
    }
    await p.setViewportSize({ width:390, height:844 });
    await p.locator('#diary-text').fill('검증용 가상 기록: 오늘은 산책을 했다.');
    await p.waitForFunction(() => document.querySelector('#save-status').textContent === '초안 저장됨');
    // A failed record transaction must never be presented as a successful save.
    await p.evaluate(() => {
      const original = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function (...args) {
        IDBObjectStore.prototype.put = original;
        throw new DOMException('검증용 저장 실패', 'QuotaExceededError');
      };
    });
    await click('save');
    await p.waitForFunction(() => DiaryReview.getState().error);
    // The failure stays on the editor (no card page) with the failure note and retry action.
    assert.equal(await p.evaluate(() => DiaryReview.getState().view), 'write');
    assert.equal(await p.locator('.mystery-card').count(), 0);
    assert.ok((await p.locator('[data-action=storage-details]').innerText()).includes('원인'));
    assert.match(await p.locator('.save-error').innerText(), /저장하지 못했어요/);
    assert.equal(await p.locator('[data-action=storage-details]').isVisible(), true);
    assert.equal(await p.locator('[data-action=retry-save]').count(), 1);
    await p.screenshot({ path:path.join(output,'save-failed-mobile.png') });
    await click('retry-save');
    // state.error clears when the action starts; wait for the save itself to finish.
    await p.waitForFunction(() => !DiaryReview.getState().error && document.querySelector('#save-status')?.textContent === '초안 저장됨');
    assert.equal(await p.locator('[data-action=storage-details]').isVisible(), false, 'failure note clears after retry');
    assert.equal(await p.locator('[data-action=retry-save]').count(), 0);
    // Phones show no recent tiles (Figma); "카드 보기" in the saved bar opens the record.
    await p.locator('.done-actions [data-open]').click();
    await click('read-full');
    assert.match(await p.locator('.full-text').innerText(), /검증용 가상 기록/);
    await p.keyboard.press('Escape');
    assert.equal(await p.evaluate(() => document.activeElement.getAttribute('popovertarget')), 'card-more', 'focus returns to the 자세히 보기 menu');
    // Opened from home, so the back button returns home; go to the archive list explicitly.
    await click('history');
    assert.equal(await p.evaluate(() => DiaryReview.getState().view), 'write');
    await click('archive-records');
    assert.match(await p.locator('.entry-preview').innerText(), /오늘은 산책/);
    assert.equal(await p.locator('.entry-preview').evaluate(el => getComputedStyle(el).whiteSpace),'normal');
    assert.equal(await p.locator('.entry-list').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length),1);
    await click('review-month');
    // 390px phone (soft UI v1.1): one scrolling column with every section, no panel switch.
    assert.equal(await p.locator('[data-stats]').count(), 0);
    for (const s of ['.stats-cards', '.stats-trend', '.stats-dist', '.stats-calendar', '.stats-weekday']) {
      await p.locator(s).scrollIntoViewIfNeeded();
      assert.equal(await p.locator(s).isVisible(), true, s);
    }
    await click('archive-records');
    assert.equal(await p.locator('.entry-preview').count(),1);
    await click('settings');
    await click('preview');
    await p.screenshot({ path:path.join(output,'archive-mobile.png') });
    await p.locator('[data-open=sample-1]').click();
    await unseal(p);
    // Phones stack the card actions (Figma mobile "카드 공개"): 도감에 넣기 above 공유하기, full width.
    const mainBox = await p.locator('.card-info-actions [data-action=card-catalog]').boundingBox();
    const shareBox = await p.locator('.card-info-actions [data-action=share]').boundingBox();
    assert.ok(shareBox.y >= mainBox.y + mainBox.height && mainBox.width >= 300, 'stacked full-width actions');
    await p.screenshot({ path:path.join(output,'card-mobile.png') });
    const download = p.waitForEvent('download');
    await click('download');
    await (await download).saveAs(path.join(output,'card.png'));
    const svg = await p.locator('.art-card').evaluate(el => el.outerHTML);
    assert.ok(svg.includes('분류 확률'));
    // Soft UI v1.1 cards show only a truncated first line (14 chars) on screen, never the rest of the diary.
    assert.ok(!svg.includes('천천히 이야기하니'));
    await p.setViewportSize({width:1440,height:900});
    await p.screenshot({path:path.join(output,'card-desktop.png')});
    // Long text and 200% text zoom remain readable in the dedicated dialog.
    await click('write');
    const longText = ('가상 기록 English123 '.repeat(600)).slice(0,10000);
    await p.locator('#diary-text').fill(longText);
    await click('save');
    // Still in example mode: saving asks before switching to real records.
    await p.locator('#confirm-dialog [data-confirm=accept]').click();
    await p.waitForFunction(() => DiaryReview.getState().mode === 'real');
    // The stored record opens the card page with the "분석 대기" panel; go back home.
    await p.locator('.wait-panel').waitFor();
    await click('history');
    await p.locator('.recent-list [data-open]').first().click();
    await click('read-full');
    assert.equal(await p.locator('.full-text').textContent(),longText.trim());
    await p.locator('#read-full-dialog').evaluate(el => el.style.zoom = '2');
    const body = p.locator('.full-text');
    await body.evaluate(el => el.scrollTop = el.scrollHeight);
    assert.ok(await p.locator('#read-full-dialog button').isVisible());
    await p.keyboard.press('Escape');
    assert.deepEqual(errors,[]);
    console.log('PASS: record hierarchy, failed save/retry, direct reading/focus, monthly default, long text, PNG; evidence: ' + output);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });


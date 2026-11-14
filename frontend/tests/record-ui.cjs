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
    assert.ok(!(await p.locator('.latest-storage').innerText()).includes('기록을 보관했어요'));
    assert.ok((await p.locator('.latest-storage').innerText()).includes('저장 확인이 필요해요'));
    await p.screenshot({ path:path.join(output,'save-failed-mobile.png') });
    await click('retry-save');
    await p.waitForFunction(() => !DiaryReview.getState().error);
    assert.ok((await p.locator('.latest-storage').innerText()).includes('기록을 보관했어요'));
    await p.locator('.recent-list [data-open]').first().click();
    await click('read-full');
    assert.match(await p.locator('.full-text').innerText(), /검증용 가상 기록/);
    await p.keyboard.press('Escape');
    assert.equal(await p.evaluate(() => document.activeElement.dataset.action), 'read-full');
    await click('history');
    assert.match(await p.locator('.entry-preview').innerText(), /오늘은 산책/);
    assert.equal(await p.locator('.entry-preview').evaluate(el => getComputedStyle(el).whiteSpace),'normal');
    assert.equal(await p.locator('.entry-list').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length),1);
    await click('review-month');
    assert.equal(await p.locator('#stats-kind').inputValue(),'count');
    await p.locator('#stats-kind').selectOption('trend');
    await click('archive-records');
    assert.equal(await p.locator('.entry-preview').count(),1);
    await click('review-month');
    assert.equal(await p.locator('#stats-kind').inputValue(),'trend');
    await click('settings');
    await p.locator('[data-action=preview]').evaluate(el => el.closest('details').open = true);
    await click('preview');
    await p.screenshot({ path:path.join(output,'archive-mobile.png') });
    await p.locator('[data-open=sample-1]').click();
    const readBox = await p.locator('[data-action=read-full]').boundingBox();
    const saveBox = await p.locator('[data-action=download]').boundingBox();
    assert.ok(saveBox.y >= readBox.y + readBox.height);
    await p.screenshot({ path:path.join(output,'card-mobile.png') });
    const download = p.waitForEvent('download');
    await click('download');
    await (await download).saveAs(path.join(output,'card.png'));
    const svg = await p.locator('.art-card').evaluate(el => el.outerHTML);
    assert.ok(svg.includes('분류 확률'));
    assert.ok(!svg.includes('오랜만에 친구'));
    await p.setViewportSize({width:1440,height:900});
    await p.screenshot({path:path.join(output,'card-desktop.png')});
    // Long text and 200% text zoom remain readable in the dedicated dialog.
    await click('write');
    const longText = ('가상 기록 English123 '.repeat(600)).slice(0,10000);
    await p.locator('#diary-text').fill(longText);
    await click('save');
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

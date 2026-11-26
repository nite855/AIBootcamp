const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.CARDEX_PLAYWRIGHT || path.join(os.tmpdir(), 'aibootcamp-frontend-review/node_modules/playwright'));

(async () => {
  const browser = await chromium.launch({ headless:true, executablePath:require('./browser-runtime.cjs').executablePath });
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'moment-taxonomy-'));
  try {
    const page = await browser.newPage({ offline:true, acceptDownloads:true, viewport:{width:1440,height:900} });
    const errors = [], requests = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => { if (/^https?:/.test(r.url())) requests.push(r.url()); });
    await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
    await page.waitForFunction(() => DiaryReview.isReady());
    const click = action => require('./browser-runtime.cjs').reveal(page, action);
    await click('settings');
    await click('preview');
    await click('catalog');
    assert.match((await page.locator('.archive-panel').innerText()).replace(/\s+/g, ' '), /27 \/ 27/);
    // Filter chips: 전체 + 9 emotions grouped by parent; the full grid shows 27 slots.
    assert.equal(await page.locator('[data-catalog-filter]').count(), 10);
    assert.equal(await page.locator('[data-catalog-filter="neu_4"]').count(), 0);
    assert.deepEqual(await page.locator('.catalog-filters .filter-group').evaluateAll(xs => xs.map(x => x.getAttribute('aria-label'))), ['긍정','부정','중립']);
    assert.equal(await page.locator('.slot[data-stage]').count(), 27);
    const types = await page.evaluate(() => CardexCore.TYPES);
    for (const type of types) {
      await page.locator(`[data-catalog-filter="${type.id}"]`).click();
      assert.equal(await page.locator('.slot[data-stage]').count(), 3);
      assert.equal(await page.locator('.slot[data-stage] .catalog-character').count(), 3);
      // 2026-11-22: blob characters in the emotion's deep color, no neutral corner badge.
      assert.equal(await page.locator('[data-emotion-mark]').count(), 0);
      assert.deepEqual(await page.locator('.slot[data-stage] .catalog-character [data-blob-part="body"] path').evaluateAll(xs => [...new Set(xs.map(x => x.getAttribute('fill')))]),
        [await page.evaluate(id => getComputedStyle(document.documentElement).getPropertyValue('--card-deep-' + id.replace('_', '-')).trim(), type.id)]);
      assert.equal(await page.evaluate(() => document.activeElement.dataset.catalogFilter), type.id, 'focus stays on the chip');
      assert.equal(await page.locator(`[data-catalog-filter="${type.id}"]`).getAttribute('aria-pressed'), 'true');
    }
    // Keyboard: Tab moves between chips, Enter applies the filter.
    await page.locator('[data-catalog-filter="neu_1"]').focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('[data-catalog-filter="neu_2"]').getAttribute('aria-pressed'), 'true');
    for (const [theme,mode] of await page.evaluate(()=>CardexTheme.themes.map(t=>[t.id,t.scheme]))) {
      await page.evaluate(theme => CardexTheme.setTheme(theme), theme);
      // Card colors are fixed tokens, so the blob looks the same in every theme.
      const fill = await page.locator('.catalog-character [data-blob-part="body"] path').first().getAttribute('fill');
      assert.equal(fill, await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--card-deep-neu-2').trim()), theme+'/'+mode);
    }
    await page.evaluate(() => CardexTheme.setTheme('candy'));
    await page.screenshot({path:path.join(output,'catalog-desktop.png')});

    for (const id of ['neu_1','neu_2','neu_3']) {
      await page.locator(`[data-catalog-filter="${id}"]`).click();
      await page.locator('.slot[data-stage="1"]').click();
      await page.locator('#card-detail[open] [data-open]').first().click();
      const type = types.find(t => t.id === id);
      assert.match(await page.locator('.art-card').textContent(), /중립/);
      assert.ok((await page.locator('.art-card').textContent()).includes(type.name));
      assert.equal(await page.locator(`.art-card [data-character="${id}"]`).count(), 1);
      const svg = await page.locator('.art-card').evaluate(el => el.outerHTML);
      assert.ok(!svg.includes('별일 없는 하루에도'), 'only a truncated first line reaches the card');
      const download = page.waitForEvent('download');
      await click('download');
      const file = await download;
      await file.saveAs(path.join(output, id+'.png'));
      const bytes = fs.readFileSync(await file.path());
      assert.equal(bytes.readUInt32BE(16),1080);
      assert.equal(bytes.readUInt32BE(20),1512);
      await page.screenshot({path:path.join(output,id+'-card.png')});
      await click('archive-records');
      await click('catalog');
    }
    await click('review-month');
    for (const [width,height] of [[1440,900],[390,844],[320,568]]) {
      await page.setViewportSize({width,height});
      await page.waitForTimeout(200);
      // Soft UI v1.1: 9 rows of card counts; phones list the top three.
      assert.equal(await page.locator('.dist-row').count(),9);
      assert.equal(await page.locator('.dist-row:visible').count(), width >= 960 ? 9 : 3);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),false);
      const labelsFit = await page.locator('.dist-row:visible .dist-name').evaluateAll(xs => xs.every(el => el.scrollWidth <= el.clientWidth + 1));
      assert.ok(labelsFit, 'long leaf labels fit at '+width);
      const last = page.locator('.dist-row:visible').last();
      await last.scrollIntoViewIfNeeded();
      const bounds = await last.boundingBox();
      assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= height, 'last leaf can be read at '+width);
      await page.screenshot({path:path.join(output,`distribution-${width}.png`)});
    }
    assert.deepEqual(errors,[]);
    assert.deepEqual(requests,[]);
    console.log('PASS: 9 labels, 27 slots, neutral symbols/PNGs, keyboard and responsive distribution. Evidence: '+output);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });

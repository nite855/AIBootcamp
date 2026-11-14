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
    await page.locator('[data-action=preview]').evaluate(el => el.closest('details').open = true);
    await click('preview');
    await click('catalog');
    assert.match(await page.locator('.archive-panel').innerText(), /30 \/ 30/);
    assert.equal(await page.locator('#catalog-type option').count(), 10);
    assert.deepEqual(await page.locator('#catalog-type optgroup').evaluateAll(xs => xs.map(x => x.label)), ['긍정','부정','중립']);
    const types = await page.evaluate(() => CardexCore.TYPES);
    for (const type of types) {
      await page.locator('#catalog-type').selectOption(type.id);
      assert.equal(await page.locator('[data-stage]').count(), 3);
      assert.equal(await page.locator('[data-stage] .catalog-character').count(), 3);
      assert.equal(await page.locator('[data-emotion-mark]').count(), type.parent === 'neutral' ? 3 : 0);
      assert.equal(await page.evaluate(() => document.activeElement.id), 'catalog-type');
    }
    await page.locator('#catalog-type').selectOption('neu_1');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#catalog-type').inputValue(), 'neu_2');
    await page.keyboard.press('Escape');
    for (const theme of await page.evaluate(()=>CardexTheme.themes.map(t=>t.id))) for (const mode of ['light','dark']) {
      await page.evaluate(({theme,mode}) => { CardexTheme.setTheme(theme); CardexTheme.set(mode); }, {theme,mode});
      const colors = await page.locator('[data-emotion-mark] > circle').first().evaluate(el => ({
        stroke:el.getAttribute('stroke'), fill:el.getAttribute('fill'),
        ink:getComputedStyle(document.documentElement).getPropertyValue('--ink').trim(),
        surface:getComputedStyle(document.documentElement).getPropertyValue('--surface').trim(),
      }));
      assert.equal(colors.stroke, colors.ink, theme+'/'+mode);
      assert.equal(colors.fill, colors.surface, theme+'/'+mode);
    }
    await page.evaluate(() => { CardexTheme.setTheme('lemon'); CardexTheme.set('light'); });
    await page.screenshot({path:path.join(output,'catalog-desktop.png')});

    for (const id of ['neu_1','neu_2','neu_3','neu_4']) {
      await page.locator('#catalog-type').selectOption(id);
      await page.locator('[data-stage="1"]').click();
      await page.locator('[data-open]').first().click();
      const type = types.find(t => t.id === id);
      assert.match(await page.locator('.art-card').textContent(), /중립/);
      assert.ok((await page.locator('.art-card').textContent()).includes(type.name));
      assert.equal(await page.locator(`[data-emotion-mark="${id}"]`).count(), 1);
      const svg = await page.locator('.art-card').evaluate(el => el.outerHTML);
      assert.ok(!svg.includes('퇴근길'));
      const download = page.waitForEvent('download');
      await click('download');
      const file = await download;
      await file.saveAs(path.join(output, id+'.png'));
      const bytes = fs.readFileSync(await file.path());
      assert.equal(bytes.readUInt32BE(16),1080);
      assert.equal(bytes.readUInt32BE(20),1620);
      await page.screenshot({path:path.join(output,id+'-card.png')});
      await click('archive-records');
      await click('catalog');
    }
    await click('review-month');
    await page.locator('#stats-kind').selectOption('distribution');
    for (const [width,height] of [[1440,900],[390,844],[320,568]]) {
      await page.setViewportSize({width,height});
      await page.waitForTimeout(200);
      assert.equal(await page.locator('.distribution-group').count(),3);
      assert.equal(await page.locator('.distribution-row').count(),10);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),false);
      const labelsFit = await page.locator('.distribution-row > span').evaluateAll(xs => xs.every(el => el.scrollWidth <= el.clientWidth + 1));
      assert.ok(labelsFit, 'long leaf labels fit at '+width);
      const last = page.locator('.distribution-row').last();
      await last.scrollIntoViewIfNeeded();
      const bounds = await last.boundingBox();
      assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= height, 'last leaf can be read at '+width);
      await page.screenshot({path:path.join(output,`distribution-${width}.png`)});
    }
    assert.deepEqual(errors,[]);
    assert.deepEqual(requests,[]);
    console.log('PASS: 10 labels, 30 slots, neutral symbols/PNGs, keyboard and responsive distribution. Evidence: '+output);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });

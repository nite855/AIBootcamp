const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const {pathToFileURL} = require('node:url');
const {reveal, executablePath} = require('./browser-runtime.cjs');
const {chromium} = require(process.env.CARDEX_PLAYWRIGHT || path.join(os.tmpdir(), 'aibootcamp-frontend-review/node_modules/playwright'));
(async () => {
  const browser = await chromium.launch({headless:true, executablePath});
  const evidence = fs.mkdtempSync(path.join(os.tmpdir(), 'moment-home-gallery-'));
  try {
    const page = await browser.newPage({offline:true});
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
    await page.waitForFunction(() => DiaryReview.isReady());
    assert.equal(await page.locator('button:visible').count(), 5);
    await reveal(page, 'archive-records');
    await page.locator('[popovertarget=main-menu]').click();
    await page.setViewportSize({width:1000,height:768});
    await page.waitForTimeout(180);
    assert.equal(await page.locator('[data-action=settings]').isVisible(), true, 'resize preserves an open menu');
    await page.keyboard.press('Escape');
    await reveal(page, 'settings');
    await page.locator('details').filter({has:page.locator('[name=policy]')}).evaluate(el => el.open = true);
    await page.locator('[name=policy][value=multi]').check();
    await reveal(page, 'write');
    for (const text of ['첫 기록', '두 번째 기록', '세 번째 기록', '<script>window.injected=1</script>']) {
      await page.locator('#diary-text').fill(text); await reveal(page, 'save');
      await page.waitForFunction(()=>Boolean(document.querySelector('[data-action=new-entry]')));
      await page.waitForFunction(() => document.querySelector('#save-status').textContent === '초안 저장됨');
      assert.equal(await page.evaluate(() => DiaryReview.getState().view), 'write');
      await reveal(page, 'new-entry');
    }
    assert.equal(await page.locator('.recent-list [data-open]').count(), 3);
    assert.equal(await page.locator('button:visible').count(), 8);
    assert.ok((await page.locator('.recent-list .entry-preview').first().innerText()).includes('<script>'));
    assert.equal(await page.evaluate(() => window.injected), undefined);
    assert.deepEqual(await page.locator('.recent-list .entry-preview').allTextContents(), ['<script>window.injected=1</script>', '세 번째 기록', '두 번째 기록']);
    await page.locator('#diary-text').fill('보존할 새 초안');
    await page.locator('.recent-list [data-open]').first().click();
    await reveal(page, 'write'); assert.equal(await page.locator('#diary-text').inputValue(), '보존할 새 초안');
    for (const [name,width,height] of [['desktop',1366,768],['mobile',390,844],['small',320,568]]) {
      await page.setViewportSize({width,height});
      await page.waitForFunction(()=>parseInt(document.documentElement.style.getPropertyValue("--app-height"))===innerHeight);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      const box = await page.locator('[data-action=save]').boundingBox();
      if (width >= 390) assert.ok(box.y + box.height <= height, name + ' save visible');
      if (width === 1366) {
        const rows = await page.locator('.recent-list').boundingBox(); assert.ok(rows.y + rows.height <= height);
      }
      if(width<=540){assert.equal(await page.evaluate(()=>document.documentElement.scrollHeight>innerHeight+1),false);const recent=await page.locator('.recent-panel').boundingBox();assert.ok(recent.y+recent.height<=height);}
      if (width === 390) { const box = await page.locator('.latest-panel').boundingBox(); assert.ok(box.y + box.height <= height); }
      await page.screenshot({path:path.join(evidence, 'home-'+name+'.png'),fullPage:true});
    }
    await reveal(page, 'settings'); await reveal(page, 'theme-gallery');
    await page.locator('[data-theme-preview=forest][data-mode=light]').click(); await page.locator('[data-apply-theme]').click();
    for (const [name,width,height] of [['desktop',1366,768],['mobile',390,844],['small',320,568]]) {
      await page.setViewportSize({width,height});
      await page.waitForFunction(()=>parseInt(document.documentElement.style.getPropertyValue("--app-height"))===innerHeight);
      await page.screenshot({path:path.join(evidence,'gallery-'+name+'.png'),fullPage:true});
      await page.locator('[data-theme-preview=starlight][data-mode=dark]').click();
      const apply = await page.locator('[data-apply-theme]').boundingBox(); assert.ok(apply.y >= 0 && apply.y + apply.height <= height);
      await page.screenshot({path:path.join(evidence,'preview-'+name+'.png')});
      await page.keyboard.press('Escape');
      assert.equal(await page.evaluate(() => CardexTheme.getTheme()), 'forest');
    }
    await reveal(page,'write');
    assert.equal(await page.locator('#diary-text').inputValue(),'보존할 새 초안');
    await page.evaluate(()=>localStorage.setItem('moment-card:diary-simple-v3:color-scheme','system'));
    await page.reload();await page.waitForFunction(()=>DiaryReview.isReady());
    assert.equal(await page.evaluate(()=>CardexTheme.getPreference()),'light');
    assert.equal(await page.evaluate(()=>localStorage.getItem('moment-card:diary-simple-v3:color-scheme')),'light');
    await page.emulateMedia({colorScheme:'dark'});
    assert.equal(await page.evaluate(()=>CardexTheme.getPreference()),'light');
    assert.deepEqual(errors, []);
    console.log('PASS: home action limit, newest three, safe text, draft retention, desktop/mobile and theme sheet. Evidence: '+evidence);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode=1; });

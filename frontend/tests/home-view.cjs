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
    // Calendar day cards are excluded; today's card button counts as 'card'.
    const homeActions = () => page.locator('button:visible:not(.day-card)').evaluateAll(bs => bs.map(b => b.dataset.action || b.dataset.open && 'open' || b.hasAttribute('data-write-edit') && 'edit' || b.dataset.cardDay && 'card' || b.getAttribute('popovertarget') || (b.dataset.writeCalendar?'view-'+b.dataset.writeCalendar:b.dataset.weekStep?'week'+b.dataset.weekStep:'month'+b.dataset.homeMonth)));
    // First run: no calendar yet (the side column shows "카드는 이렇게 모여요").
    // "다른 질문" under the empty editor's question line (2026-11-24); it hides once today is written.
    assert.deepEqual(await homeActions(), ['write','write','review-month','catalog','settings','help-write-inline','draft-more','save','favorite-records','archive-records']);
    await reveal(page, 'archive-records');
    assert.equal(await page.locator('[popovertarget=main-menu]').count(), 0, 'no overflow menu in the top bar');
    await page.setViewportSize({width:1000,height:768});
    await page.waitForTimeout(180);
    assert.equal(await page.locator('[data-action=settings]').isVisible(), true, 'resize keeps the tab bar reachable');
    await page.keyboard.press('Escape');
    await reveal(page, 'settings');
    // One record per day: the record-policy choice is gone and saving again updates today's record.
    assert.equal(await page.locator('[name=policy]').count(), 0);
    await reveal(page, 'write');
    for (const text of ['첫 기록', '두 번째 기록', '<script>window.injected=1</script>']) {
      await page.locator('#diary-text').fill(text); await reveal(page, 'save');
      await page.waitForFunction(() => document.querySelector('#save-status').textContent === '임시 보관됨');
      assert.equal(await page.evaluate(() => DiaryReview.getState().view), 'write');
      assert.equal(await page.locator('[data-action=new-entry]').count(), 0);
    }
    assert.equal(await page.evaluate(() => DiaryReview.getState().sessions.length), 1);
    assert.equal(await page.locator('.recent-list [data-open]').count(), 1);
    // After saving (Figma "오늘 작성 완료"): 수정하기 / 카드 보기 replace save, then a recent tile and today's card.
    assert.deepEqual(await homeActions(), ['write','write','review-month','catalog','settings','edit','open','draft-more','favorite-records','archive-records','open','card','week-1','week1','view-week','view-month']);
    assert.match(await page.locator('#write-title').innerText(), /오늘의 기록을\s*남겼어요/);
    assert.equal(await page.evaluate(() => window.injected), undefined);
    assert.deepEqual(await page.locator('.recent-list .entry-preview').allTextContents(), ['<script>window.injected=1</script>']);
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
        // Desktop: today's card and the week rail sit beside the editor, above the fold.
        const rail = await page.locator('.write-calendar').boundingBox(); assert.ok(rail.y + rail.height <= height, 'week rail above the fold');
      }
      // Phones scroll through stacked panels; the card calendar follows the editor (soft UI v1.1).
      if (width <= 540) { for (const s of ['.recent-panel', '.write-calendar']) { await page.locator(s).scrollIntoViewIfNeeded(); assert.equal(await page.locator(s).isVisible(), true, s); } await page.evaluate(() => scrollTo(0, 0)); }
      await page.screenshot({path:path.join(evidence, 'home-'+name+'.png'),fullPage:true});
    }
    await reveal(page, 'settings');
    assert.equal(await page.locator('[data-action=theme-gallery], [data-theme-preview], #theme-dialog').count(), 0, 'one theme picker only');
    await page.locator('.theme-swatch[data-theme-id=sage]').click();
    for (const [name,width,height] of [['desktop',1366,768],['mobile',390,844],['small',320,568]]) {
      await page.setViewportSize({width,height});
      await page.waitForFunction(()=>parseInt(document.documentElement.style.getPropertyValue("--app-height"))===innerHeight);
      await page.screenshot({path:path.join(evidence,'settings-'+name+'.png'),fullPage:true});
      const swatch = page.locator('.theme-swatch[data-theme-id=night]');
      await swatch.scrollIntoViewIfNeeded();
      const box = await swatch.boundingBox(); assert.ok(box.x >= 0 && box.x + box.width <= width, name + ' swatch inside viewport');
      assert.equal(await page.evaluate(() => CardexTheme.getTheme()), 'sage');
    }
    await reveal(page,'write');
    assert.equal(await page.locator('#diary-text').inputValue(),'보존할 새 초안');
    // The old light/dark key is dropped; the OS color scheme never changes the theme.
    await page.evaluate(()=>localStorage.setItem('moment-card:diary-simple-v3:color-scheme','dark'));
    await page.reload();await page.waitForFunction(()=>DiaryReview.isReady());
    assert.equal(await page.evaluate(()=>CardexTheme.getPreference()),'light');
    assert.equal(await page.evaluate(()=>localStorage.getItem('moment-card:diary-simple-v3:color-scheme')),null);
    await page.emulateMedia({colorScheme:'dark'});
    assert.equal(await page.evaluate(()=>CardexTheme.getPreference()),'light');
    assert.deepEqual(errors, []);
    console.log('PASS: home action limit, newest three, safe text, draft retention, desktop/mobile and theme sheet. Evidence: '+evidence);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode=1; });

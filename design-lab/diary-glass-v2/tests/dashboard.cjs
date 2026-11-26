const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const {pathToFileURL} = require('node:url');
const {chromium} = require(process.env.CARDEX_PLAYWRIGHT || path.join(os.tmpdir(), 'aibootcamp-frontend-review/node_modules/playwright'));
(async () => {
  const browser = await chromium.launch({headless:true, executablePath:process.env.CARDEX_CHROMIUM || 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  try {
    const page = await browser.newPage({offline:true, viewport:{width:1440,height:900}});
    const errors=[];
    page.on('pageerror', e=>errors.push(e.message));
    await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);
    const click = a=>page.locator(`[data-action="${a}"]`).first().click();
    assert.equal(await page.locator('.empty-summary').count(),1);
    await click('save');
    assert.equal(await page.evaluate(()=>DiaryReview.getState().sessions.length),0);
    await page.locator('#diary-text').fill('오늘의 작은 행복 <img src=x onerror=alert(1)>');
    await click('save');
    await click('nav-write');
    assert.equal(await page.locator('.recent-entry').count(),1);
    assert.ok((await page.locator('.week-chart').getAttribute('aria-label')).includes('1편'));
    assert.equal(await page.locator('.recent-entry img').count(),1);
    await page.locator('.recent-entry').click();
    await click('edit-example');
    await page.locator('#sample-text').fill('수정한 오늘의 순간');
    await click('save-example');
    await click('nav-write');
    assert.ok((await page.locator('.recent-entry').innerText()).includes('수정한 오늘의 순간'));
    await page.locator('.recent-entry').click();
    await click('delete-example');
    await click('delete-example');
    await click('nav-write');
    assert.equal(await page.locator('.empty-summary').count(),1);
    await page.reload();
    for(const width of [1440,375]) {
      await page.setViewportSize({width,height:900});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      assert.equal(await page.locator('img').evaluateAll(imgs=>imgs.every(i=>i.complete && i.naturalWidth>0)),true);
      assert.equal((await page.locator('.dashboard').innerText()).includes('??'),false);
      await page.screenshot({path:path.resolve(__dirname,`../docs/previews/dashboard-${width}.png`),fullPage:true});
    }
    await click('nav-stats');
    assert.equal(await page.locator('[data-archive=stats]').getAttribute('aria-pressed'),'true');
    assert.deepEqual(errors,[]);
    console.log('PASS: dashboard empty/save/edit/delete, weekly counts, escaped text, navigation, embedded PNGs, 1440/375px');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});


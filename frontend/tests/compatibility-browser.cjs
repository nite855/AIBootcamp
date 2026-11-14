const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const {pathToFileURL} = require('node:url');
const {chromium} = require(process.env.CARDEX_PLAYWRIGHT || path.join(os.tmpdir(),'aibootcamp-frontend-review/node_modules/playwright'));
(async () => {
  const browser = await chromium.launch({headless:true,executablePath:require('./browser-runtime.cjs').executablePath});
  try {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);
    await page.waitForFunction(() => window.DiaryReview?.isReady());
    const legacy = {schemaVersion:1,revision:4,text:'이전 초안',date:'2026-11-10',policy:'multi',currentEntryId:'legacy',savedText:'이전 원문',sessions:[{id:'legacy',text:'이전 원문',recordDate:'2026-11-10',version:2,createdAt:'2026-11-10T10:00:00Z',updatedAt:'2026-11-10T11:00:00Z'}]};
    await page.evaluate(async data => {
      const db = await new Promise(resolve => {const r=indexedDB.open('moment-diary-main',1);r.onsuccess=()=>resolve(r.result);});
      await new Promise((resolve,reject) => {const tx=db.transaction('data','readwrite');tx.objectStore('data').put(data,'state');tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);}); db.close();
      localStorage.setItem('moment-card:diary-simple-v3:appearance','sage');
      localStorage.setItem('moment-card:diary-simple-v3:color-scheme','dark');
    },legacy);
    await page.reload(); await page.waitForFunction(() => window.DiaryReview?.isReady());
    const state = await page.evaluate(() => DiaryReview.getState());
    assert.equal(state.text,legacy.text); assert.equal(state.policy,'multi');
    assert.equal(state.sessions[0].id,'legacy'); assert.equal(state.sessions[0].version,2);
    assert.equal(state.sessions[0].favorite,false);
    assert.equal(await page.getAttribute('html','data-appearance'),'sage');
    assert.equal(await page.getAttribute('html','data-theme'),'dark');
    await page.locator('[data-action=archive-records]').click();
    await page.locator('[data-open=legacy]').click();
    await require('./browser-runtime.cjs').reveal(page,'favorite');
    await page.reload(); await page.waitForFunction(() => window.DiaryReview?.isReady());
    assert.equal(await page.evaluate(() => DiaryReview.getState().sessions[0].favorite),true);
    assert.equal(await page.locator('#diary-text').inputValue(),'이전 초안');
    console.log('PASS: legacy main records/draft/policy/theme preserved; favorite defaults and persists');
  } finally {await browser.close();}
})().catch(error => {console.error(error);process.exitCode=1;});

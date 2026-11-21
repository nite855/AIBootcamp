const assert=require('node:assert/strict'), path=require('node:path'),os=require('node:os'),fs=require('node:fs');
const {chromium}=require(process.env.CARDEX_PLAYWRIGHT || path.join(os.tmpdir(),'aibootcamp-frontend-review/node_modules/playwright'));
(async()=>{
  const url=process.env.MOMENT_LAN_URL;
  if(!url) throw Error('Set MOMENT_LAN_URL to the PC LAN HTTP URL.');
  const browser=await chromium.launch({headless:true,executablePath:require('./browser-runtime.cjs').executablePath});
  const out=fs.mkdtempSync(path.resolve(__dirname,'../../reports/frontend-integration/lan-'));
  try {
    const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,acceptDownloads:true});
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(url); await page.waitForFunction(()=>window.DiaryReview?.isReady());
    const security=await page.evaluate(()=>({secure:isSecureContext,nativeUUID:typeof crypto.randomUUID,randomValues:typeof crypto.getRandomValues}));
    assert.equal(security.secure,false);assert.equal(security.nativeUUID,'undefined');
    await page.locator('#diary-text').fill('모바일 LAN HTTP 저장 검증 🌿');
    await page.locator('[data-action=save]').tap();
    await page.waitForFunction(()=>DiaryReview.getState().sessions.length===1 && !DiaryReview.getState().error && document.querySelector('#save-status')?.textContent==='초안 저장됨');
    const entry=await page.evaluate(()=>DiaryReview.getState().sessions[0]);
    assert.match(entry.id,/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    await page.locator('.recent-list [data-open]').first().tap();
    await require('./browser-runtime.cjs').reveal(page,'favorite');
    await page.reload(); await page.waitForFunction(()=>window.DiaryReview?.isReady());
    assert.equal(await page.evaluate(()=>DiaryReview.getState().sessions[0].favorite),true);
    await page.locator('[data-action=archive-records]').tap();
    await page.locator('[data-open]').first().tap();await page.locator('[data-action=read-full]').tap();
    assert.equal(await page.locator('.full-text').innerText(),'모바일 LAN HTTP 저장 검증 🌿');
    await page.locator('#read-full-dialog button').tap();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.screenshot({path:path.join(out,'mobile-lan.png'),fullPage:true});
    assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({url,security,storedId:entry.id,errors,browser:await browser.version(),passed:['HTTP insecure context','UUID fallback','record save','favorite persists after reload','read record','no horizontal overflow']},null,2));
    console.log('PASS: LAN HTTP mobile save/reload/favorite/read. Evidence: '+out);
    await context.close();
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

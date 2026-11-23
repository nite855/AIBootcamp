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
    // A successful save opens the card page with the "분석 대기" panel (2026-11-19); a failure stays in the editor.
    const wait=page.locator('.wait-panel');
    await wait.waitFor();
    assert.equal(await page.evaluate(()=>DiaryReview.getState().sessions.length),1);
    assert.equal(await page.evaluate(()=>!DiaryReview.getState().error),true);
    assert.equal(await wait.locator('#wait-title').innerText(),'기록은 잘 저장됐어요');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.screenshot({path:path.join(out,'mobile-lan-wait.png'),fullPage:true});
    await wait.locator('[data-wait-action=write]').tap();
    await page.locator('#diary-text').waitFor();
    const entry=await page.evaluate(()=>DiaryReview.getState().sessions[0]);
    assert.match(entry.id,/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    // Phones hide the recent tiles (write.css), so records open from the full list.
    await page.locator('[data-action=archive-records]').tap();
    await page.locator('.entry[data-open]:visible').first().tap();
    await require('./browser-runtime.cjs').reveal(page,'favorite');
    await page.reload(); await page.waitForFunction(()=>window.DiaryReview?.isReady());
    assert.equal(await page.evaluate(()=>DiaryReview.getState().sessions[0].favorite),true);
    await page.locator('[data-action=archive-records]').tap();
    await page.locator('.entry[data-open]:visible').first().tap();await require('./browser-runtime.cjs').reveal(page,'read-full');
    assert.equal(await page.locator('.full-text').innerText(),'모바일 LAN HTTP 저장 검증 🌿');
    await page.locator('#read-full-dialog button').tap();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.screenshot({path:path.join(out,'mobile-lan.png'),fullPage:true});
    assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({url,security,storedId:entry.id,errors,browser:await browser.version(),passed:['HTTP insecure context','UUID fallback','record save','save opens analysis-wait panel','favorite persists after reload','read record','no horizontal overflow']},null,2));
    console.log('PASS: LAN HTTP mobile save/reload/favorite/read. Evidence: '+out);
    await context.close();
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

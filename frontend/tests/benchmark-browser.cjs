const assert=require('node:assert/strict'), fs=require('node:fs'), path=require('node:path'), os=require('node:os');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.CARDEX_PLAYWRIGHT || path.join(os.tmpdir(),'aibootcamp-frontend-review/node_modules/playwright'));
const B=require('../scripts/backup.js');
const output=fs.mkdtempSync(path.join(os.tmpdir(),'moment-ui-integration-'));
fs.mkdirSync(output,{recursive:true});
const appURL=pathToFileURL(path.resolve(__dirname,'../index.html')).href;
let checks=0;
const check=(value,message)=>{assert.ok(value,message);checks++;};
(async()=>{
  const browser=await chromium.launch({headless:true, executablePath:require('./browser-runtime.cjs').executablePath});
  const errors=[], requests=[];
  try {
    const c=await browser.newContext({offline:true,acceptDownloads:true});
    const p=await c.newPage(); p.setDefaultTimeout(15000); p.on('dialog',d=>d.accept());
    p.on('pageerror',e=>errors.push(e.message));
    p.on('request',r=>{if(/^https?:/.test(r.url())) requests.push(r.url());});
    const click=action=>require('./browser-runtime.cjs').reveal(p,action);
    const ready=()=>p.waitForFunction(()=>window.DiaryReview?.isReady());
    await p.goto(appURL); await ready();
    await p.evaluate(()=>localStorage.setItem('moment-card:diary-benchmark-v1:appearance','main-sentinel'));
    const today=await p.evaluate(()=>DiaryReview.localDate());
    await p.evaluate(async () => {
      const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('moment-diary-benchmark-v1',1); r.onupgradeneeded=()=>r.result.createObjectStore('data'); r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error);});
      await new Promise((resolve,reject)=>{const tx=db.transaction('data','readwrite');tx.objectStore('data').put({sentinel:'UNCHANGED'},'state');tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});db.close();
    });
    const samples=Array.from({length:12},(_,i)=>({id:'import-'+i,text:['가벼운 산책을 했다. 바람이 좋았다.','조용히 커피를 마시며 쉬었다.','친구와 함께 웃었던 순간.'][i%3],favorite:i%3===0,
      recordDate:today.slice(0,8)+String(i+1).padStart(2,'0'),version:1,createdAt:today+'T10:00:00Z',updatedAt:today+'T10:00:00Z'}));
    const upload=async entries=>{
      await click('settings'); await p.locator('details').filter({has:p.locator('.backup-panel')}).locator('summary').click();
      await p.locator('#backup-file').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(B.create(entries)))});
      await p.waitForFunction(()=>document.querySelector('#backup-preview')?.textContent.includes('추가'));
    };
    for(const [name,width,height] of [['pc',1440,900],['laptop',1024,768],['tablet',768,1024],['mobile',390,844],['narrow',360,800],['small',320,568],['landscape',844,390]]) {
      await p.setViewportSize({width,height}); await click('write');
      check(!await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),name+' horizontal overflow');
      check(await p.locator('#diary-text').isVisible(),name+' editor visible');
      await p.screenshot({path:path.join(output,`write-${name}.png`),fullPage:true});
    }
    await p.setViewportSize({width:390,height:844});
    await click('help-write'); check(await p.locator('#info-dialog').isVisible(),'writing prompt');await p.keyboard.press('Escape');
    check(await p.locator('#diary-text').inputValue()==='','prompt never edits draft');
    await click('save'); check(await p.locator('#feedback').innerText()!=='','empty validation');
    await p.locator('#diary-text').fill('오늘의 한 줄 🌿\n<script>window.injected=1</script>');
    await p.waitForFunction(()=>document.querySelector('#save-status').textContent==='초안 저장됨');
    await p.reload(); await ready(); check((await p.locator('#diary-text').inputValue()).includes('오늘의 한 줄'),'draft reload');
    await click('save'); await p.waitForFunction(()=>DiaryReview.getState().view==='write');
    await p.locator('.recent-list [data-open]').first().click();
    await click('favorite'); await click('read-full');
    check((await p.locator('.full-text').innerText()).includes('<script>'),'literal imported markup');
    check(!await p.evaluate(()=>window.injected),'no script injection');
    await p.keyboard.press('Escape'); check(await p.locator('[data-action=read-full]').evaluate(el=>el===document.activeElement),'dialog focus return');
    const cardBox=await p.locator('.flip-scene').boundingBox();
    check(cardBox.width>=260 && Math.abs(cardBox.height/cardBox.width-1.5)<0.02,'readable mobile card geometry');
    await p.screenshot({path:path.join(output,'card-mobile.png'),fullPage:true});
    await p.setViewportSize({width:1440,height:900});
    check(await p.locator('.record-panel').isVisible() && await p.locator('.card-area').isVisible(),'desktop record detail has card');
    await p.screenshot({path:path.join(output,'card-pc.png'),fullPage:true});
    await p.setViewportSize({width:390,height:844});
    await p.reload(); await ready(); await click('archive-records');
    check((await p.locator('.entry-list').innerText()).includes('★ 즐겨찾기'),'favorite persisted');
    await upload(samples); await p.screenshot({path:path.join(output,'restore-mobile.png'),fullPage:true});
    await click('confirm-import'); await p.waitForFunction(()=>DiaryReview.getState().sessions.length===13);
    check((await p.evaluate(()=>DiaryReview.getState().sessions.length))===13,'merge import');
    await click('archive-records'); await p.locator('#record-search').fill('산책');
    check(await p.locator('.entry').count()===4,'search results');
    check(await p.locator('#record-search').evaluate(el=>el===document.activeElement),'search focus');
    check(await p.locator('#record-search').evaluate(el=>{
      el.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));
      el.value='커'; el.dispatchEvent(new InputEvent('input',{bubbles:true,isComposing:true}));
      const retained=el.isConnected;
      el.value='커피';el.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true}));
      return retained && document.querySelector('#record-search').value==='커피';
    }),'Korean IME composition retains input element');
    await p.locator('#record-search').fill('산책');
    await p.locator('.record-filters summary').click(); await p.locator('#favorites-only').check(); check(await p.locator('.entry').count()===4,'combined favorite search');
    await p.locator('#record-search').fill('없는 단어'); check(await p.locator('.entry').count()===0,'empty search');
    await click('reset-search');
    for(const [name,width,height] of [['pc',1440,900],['mobile',390,844],['small',320,568],['landscape',844,390]]) {
      await p.setViewportSize({width,height}); await click('archive-records');
      check(!await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),name+' archive overflow');
      await p.screenshot({path:path.join(output,`archive-${name}.png`),fullPage:true});
      await click('review-month');
      check(await p.locator('.calendar-day').count()>=28,'calendar day count');
      check(!await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),name+' calendar overflow');
      await p.screenshot({path:path.join(output,`calendar-${name}.png`),fullPage:true});
    }
    await p.locator(`[data-month-date="${today.slice(0,8)}01"]`).click();
    check(await p.locator('.entry').count()===1,'calendar opens date-filtered records');
    await upload(samples); check(await p.locator('[data-action=confirm-import]').isDisabled(),'duplicate import skipped');
    await click('cancel-import');
    await p.locator('#backup-file').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{')});
    await p.waitForFunction(()=>document.querySelector('#feedback')?.textContent.includes('JSON'));
    check((await p.evaluate(()=>DiaryReview.getState().sessions.length))===13,'bad JSON preserves records');
    await p.locator('#backup-file').setInputFiles({name:'conflict.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(B.create([{...samples[0],text:'충돌'}])))});
    await p.waitForFunction(()=>document.querySelector('#backup-preview')?.textContent.includes('충돌 1'));
    check(await p.locator('[data-action=confirm-import]').isDisabled(),'conflicting import blocked');
    await click('cancel-import');
    const download=p.waitForEvent('download'); await click('export-backup');
    const exported=await download; const json=JSON.parse(fs.readFileSync(await exported.path(),'utf8'));
    check(json.entries.length===13 && !json.entries.some(r=>'analysis' in r),'export actual records only');
    const added={...samples[0],id:'failure-test',text:'실패 복원'};
    await p.locator('#backup-file').setInputFiles({name:'new.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(B.create([added])))});
    await p.waitForFunction(()=>document.querySelector('[data-action=confirm-import]')?.disabled===false);
    await p.evaluate(()=>{const original=IDBObjectStore.prototype.put; IDBObjectStore.prototype.put=function(...args){IDBObjectStore.prototype.put=original;throw new DOMException('검증용 실패','QuotaExceededError');};});
    await click('confirm-import'); await p.waitForFunction(()=>document.querySelector('#feedback')?.textContent.includes('검증용 실패'));
    check((await p.evaluate(()=>DiaryReview.getState().sessions.length))===13,'failed import retains in-memory records');
    await p.screenshot({path:path.join(output,'restore-failed.png'),fullPage:true});
    await p.reload(); await ready(); check((await p.evaluate(()=>DiaryReview.getState().sessions.length))===13,'failed import retains persisted records');
    await click('write'); await p.locator('#diary-text').fill('저장 실패에도 남는 원문');
    await p.waitForFunction(()=>document.querySelector('#save-status')?.textContent==='초안 저장됨');
    await p.evaluate(()=>{const original=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args){IDBObjectStore.prototype.put=original;throw new DOMException('검증용 저장 실패','QuotaExceededError');};});
    await click('save'); await p.waitForFunction(()=>DiaryReview.getState().error);
    check(!(await p.locator('.latest-storage').innerText()).includes('기록을 보관했어요'),'save failure never announces success');
    await click('retry-save'); await p.waitForFunction(()=>!DiaryReview.getState().error && document.querySelector('#save-status')?.textContent==='초안 저장됨');
    check((await p.locator('.latest-storage').innerText()).includes('기록을 보관했어요'),'save retry');
    check(await p.evaluate(()=>localStorage.getItem('moment-card:diary-benchmark-v1:appearance'))==='main-sentinel','prototype settings isolated');
    check(await p.evaluate(async()=>{
      const db=await new Promise(resolve=>{const r=indexedDB.open('moment-diary-benchmark-v1',1);r.onsuccess=()=>resolve(r.result);});
      const data=await new Promise(resolve=>{const tx=db.transaction('data','readonly'),r=tx.objectStore('data').get('state');tx.oncomplete=()=>resolve(r.result);});db.close();return data.sentinel==='UNCHANGED';
    }),'prototype IndexedDB isolated');
    check(!errors.length,JSON.stringify(errors)); check(!requests.length,'no external requests');
    const result={checks,errors,externalRequests:requests, browser:await browser.version(),screenshots:fs.readdirSync(output).filter(f=>f.endsWith('.png'))};
    fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(result,null,2));
    console.log(JSON.stringify({passed:checks,errors,screenshots:result.screenshots.length,evidence:output}));
    await c.close();
  } catch(error) { console.error('BROWSER CHECK FAILED',error); throw error; } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});

const assert = require('node:assert/strict'), path = require('node:path'), os = require('node:os');
const {pathToFileURL} = require('node:url');
const {chromium} = require(process.env.CARDEX_PLAYWRIGHT || path.join(os.tmpdir(),'aibootcamp-frontend-review/node_modules/playwright'));
const {reveal, executablePath} = require('./browser-runtime.cjs');
(async () => {
  const browser = await chromium.launch({headless:true, executablePath});
  try {
    for (const width of [390,1440]) {
      const context = await browser.newContext({viewport:{width,height:844},hasTouch:true,isMobile:width<960});
      const page = await context.newPage(), errors=[];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(process.env.CARDEX_TEST_URL || pathToFileURL(path.resolve(__dirname,'../index.html')).href);
      await page.waitForFunction(()=>DiaryReview.isReady());
      await reveal(page,'settings'); await reveal(page,'preview'); await reveal(page,'catalog');
      const slot = page.locator('.slot:not(.is-locked)').first();
      const client = await context.newCDPSession(page);
      const scroll = () => page.evaluate(()=> [...document.querySelectorAll('*')].reduce((sum,e)=>sum+e.scrollTop,window.scrollY));
      await slot.scrollIntoViewIfNeeded();
      const box = await slot.boundingBox(), point={x:box.x+box.width/2,y:box.y+box.height*.8};
      const before = await scroll();
      await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});
      for (const d of [10,30,60,100]) { await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:point.x,y:point.y-d}]}); await page.waitForTimeout(30); }
      await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      await page.waitForTimeout(150);
      assert.ok(await scroll()>before,'list vertical gesture actually scrolls');
      assert.equal(await page.locator('#card-detail[open]').count(),0);
      await page.waitForTimeout(700); // Finish native scroll inertia before a new tap.
      for (const close of [width < 960 ? '.detail-back' : '.detail-close','.secondary[data-close-detail]','Escape']) {
        await slot.evaluate(e=>e.scrollIntoView({block:'nearest',behavior:'instant'}));
        await page.waitForTimeout(700);
        if (close === 'Escape') { await slot.focus(); await page.keyboard.press('Enter'); }
        else await slot.tap();
        const detail=page.locator('#card-detail[open]'); await detail.waitFor();
        const art=detail.locator('.detail-card');
        const rect=await art.boundingBox(), p={x:rect.x+rect.width/2,y:rect.y+rect.height*.6};
        await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p]});
        await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:p.x,y:p.y-50}]});
        await page.waitForFunction(()=>document.querySelector('.detail-card').style.getPropertyValue('--shine')==='1');
        await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
        if(close==='Escape') { await page.keyboard.press('Tab'); await page.keyboard.press('Escape'); } else await detail.locator(close).click();
        await page.waitForFunction(()=>!document.querySelector('#card-detail'));
        assert.equal(await page.locator('.slot[aria-pressed=true]').count(),0);
        assert.equal(await page.evaluate(()=>DiaryReview.getState().catalogStage),null);
        assert.equal(await slot.locator('.mini-card').evaluate(e=>e.style.getPropertyValue('--shine') || '0'),'0');
        assert.equal(await slot.evaluate(e=>e===document.activeElement),true);
      }
      assert.deepEqual(errors,[]); await context.close();
    }
    console.log('PASS: native list scroll, vertical detail tilt, close/back/Escape neutral return and focus');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});

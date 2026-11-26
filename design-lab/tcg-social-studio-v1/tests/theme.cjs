const assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.CARDEX_PLAYWRIGHT||'playwright');
const url=pathToFileURL(path.resolve(__dirname,'../index.html')).href;
let browser;
(async()=>{
 browser=await chromium.launch({headless:true,executablePath:process.env.CARDEX_CHROMIUM,args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
 const context=await browser.newContext({colorScheme:'dark'}),page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url+'?preview=overview');assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
 await page.emulateMedia({colorScheme:'light'});await page.waitForFunction(()=>document.documentElement.dataset.theme==='light');assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
 await page.locator('#theme-preference').selectOption('dark');assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
 const summary=await page.evaluate(()=>CardexApp.getState().result.summary);
 await page.locator('a[href="#gallery"]').first().click();assert.equal(await page.locator('#theme-preference').inputValue(),'dark');
 await page.reload();assert.equal(await page.locator('#theme-preference').inputValue(),'dark');
 await page.emulateMedia({colorScheme:'light'});assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
 await page.locator('#theme-preference').selectOption('system');assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
 await page.emulateMedia({colorScheme:'dark'});await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark');assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
 await page.goto(url+'?preview=overview');await page.locator('#theme-preference').selectOption('light');assert.deepEqual(await page.evaluate(()=>CardexApp.getState().result.summary),summary);
 for(const mode of ['light','dark'])for(const width of [320,390,834,1440])for(const route of ['start','upload','speaker','progress','overview','cardex','gallery','detail','distribution','flow','period','calendar','repeats','summary','states']){
  await page.setViewportSize({width,height:900});await page.goto(url+'?preview='+route);await page.locator('#theme-preference').selectOption(mode);await page.evaluate(()=>document.fonts.ready);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),route+' '+mode+' '+width);
 }
 await page.goto(url+'?preview=detail');await page.locator('#theme-preference').selectOption('dark');await page.locator('button[data-action="zoom"]').click();assert.equal(await page.locator('#zoom-dialog').evaluate(d=>d.open),true);await page.keyboard.press('Escape');
 await page.evaluate(()=>window.dispatchEvent(new StorageEvent('storage',{key:'moment-card:tcg-social-studio:color-scheme',newValue:'light'})));assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
 const blocked=await browser.newContext({colorScheme:'dark'});await blocked.addInitScript(()=>{Object.defineProperty(window,'localStorage',{get(){throw new Error('blocked');}});});const p=await blocked.newPage();await p.goto(url);await p.locator('#theme-preference').selectOption('light');assert.equal(await p.locator('html').getAttribute('data-theme'),'light');
 await page.goto(url+'?preview=overview');await page.locator('#theme-preference').selectOption('dark');await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'/tmp/cardex-dark-review.png',fullPage:false});
 assert.deepEqual(errors,[]);await browser.close();console.log('PASS theme persistence, system changes, manual override, cross-tab, blocked storage, unchanged probabilities, dialogs; 120 route/mode/width combinations');
})().catch(async e=>{console.error(e);await browser?.close();process.exitCode=1;});


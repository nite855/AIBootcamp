const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {chromium}=require(process.env.CARDEX_PLAYWRIGHT||'playwright');
const url=pathToFileURL(path.resolve(__dirname,'../index.html')).href;
let browser;
(async()=>{
 browser=await chromium.launch({headless:true,executablePath:process.env.CARDEX_CHROMIUM,args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 let count=0;
 for(const mode of ['light','dark'])for(const width of [320,390,834,1440])for(const route of ['overview','cardex','gallery','detail','distribution','flow','period','calendar','repeats']){
  await page.setViewportSize({width,height:844});await page.goto(url+'?preview='+route+'&leaf=pos_3&parent=positive');
  await page.evaluate(({route,mode})=>{CardexApp.preview(route,{leaf:'pos_3',parentId:'positive',flowView:'seven'});CardexTheme.set(mode);},{route,mode});await page.evaluate(()=>document.fonts.ready);
  const text=await page.locator('main').innerText();assert.ok(!/안정(?!성|된)/.test(text),route+' '+mode);
  assert.equal(await page.evaluate(()=>CardexCore.type('pos_3').name),'평온');
  if(['overview','cardex','gallery','detail','distribution','flow','calendar'].includes(route))assert.match(text,/평온/);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));count++;
 }
 await page.goto(url+'?preview=gallery&parent=positive');await page.locator('#card-search').fill('평온');assert.equal(await page.locator('.card-grid [data-card-id="pos_3"]').count(),1);
 await page.locator('.card-grid [data-card-id="pos_3"]').click();await page.waitForFunction(()=>CardexApp.getState().route==='detail');assert.match(await page.locator('h1').innerText(),/평온/);assert.match(await page.locator('main').innerText(),/안정된 ID pos_3/);
 await page.locator('button[data-action="zoom"]').click();assert.match(await page.locator('#zoom-title').innerText(),/평온/);await page.keyboard.press('Escape');
 await page.setViewportSize({width:390,height:844});await page.goto(url+'?preview=overview');await page.evaluate(()=>CardexTheme.set('dark'));await page.evaluate(()=>document.fonts.ready);
 const evidence=await page.locator('main section.panel').evaluateAll(els=>els.map(el=>({heading:el.querySelector('h2')?.textContent,top:Math.round(el.getBoundingClientRect().top+scrollY),height:Math.round(el.getBoundingClientRect().height)})));
 console.log('MOBILE EVIDENCE '+JSON.stringify(evidence));console.log('Chart focus points '+await page.locator('.chart-point[tabindex="0"]').count());
 await page.screenshot({path:'/tmp/cardex-label-mobile.png',fullPage:true});
 await page.setViewportSize({width:1440,height:1000});await page.goto(url+'?preview=detail&leaf=pos_3');await page.evaluate(()=>CardexTheme.set('light'));await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:'/tmp/cardex-label-detail.png',fullPage:false});
 assert.deepEqual(errors,[]);await browser.close();console.log('PASS '+count+' label/route/mode/width cases; search, detail, zoom, technical terminology preserved');
})().catch(async e=>{console.error(e);await browser?.close();process.exitCode=1;});

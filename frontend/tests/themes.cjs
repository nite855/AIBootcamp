const {reveal,executablePath}=require('./browser-runtime.cjs');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.CARDEX_PLAYWRIGHT || path.join(os.tmpdir(),'aibootcamp-frontend-review/node_modules/playwright'));
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath});
 try {
  const page=await browser.newPage({offline:true,acceptDownloads:true});page.setDefaultTimeout(10000);
  const errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
  const url=pathToFileURL(path.resolve(__dirname,'../index.html')).href;
  await page.goto(url);await page.waitForFunction(()=>DiaryReview.isReady());
  await page.locator('#diary-text').fill('PRIVATE_DRAFT');
  await reveal(page,'settings');await reveal(page,'theme-gallery');
  const ids=await page.evaluate(()=>CardexTheme.themes.map(t=>t.id));
  assert.equal(ids.length,9);assert.equal(new Set(ids).size,9);
  assert.deepEqual(ids.slice(-3),['forest','sunset','starlight']);
  assert.equal(await page.locator('[data-theme-preview]').count(),18);
  await page.locator('[data-theme-preview=forest][data-mode=dark]').click();
  assert.equal(await page.evaluate(()=>CardexTheme.getTheme()),'lemon');
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(()=>CardexTheme.getTheme()),'lemon');
  for(const id of ids) for(const mode of ['light','dark']) {
   await page.locator(`[data-theme-preview=${id}][data-mode=${mode}]`).click();await page.locator('[data-apply-theme]').click();
   assert.equal(await page.getAttribute('html','data-appearance'),id);assert.equal(await page.getAttribute('html','data-theme'),mode);
   assert.equal(await page.locator('.applied-badge').count(),1);
   assert.equal(await page.locator(`[data-theme-preview=${id}][data-mode=${mode}]`).locator("..").locator(".applied-badge").count(),1);
   const ratios=await page.evaluate(()=>{
    const css=getComputedStyle(document.documentElement);
    const lum=n=>{const h=css.getPropertyValue(n).trim().slice(1);const rgb=[0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
    return [['--ink','--surface'],['--muted','--surface'],['--ink','--paper'],['--muted','--paper'],['--blue','--on-accent']].map(([a,b])=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05));
   });assert.ok(ratios.every(r=>r>=4.5),`${id}/${mode}: ${ratios}`);
   for(const size of [{width:1366,height:768},{width:390,height:844},{width:320,height:568}]) {
    await page.setViewportSize(size);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    assert.equal(await page.locator('.theme-gallery-grid').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),size.width>540?3:2);
   }
  }
  await page.emulateMedia({colorScheme:'light'});assert.equal(await page.getAttribute('html','data-theme'),'dark');
  await page.reload();await page.waitForFunction(()=>DiaryReview.isReady());
  assert.equal(await page.locator('#diary-text').inputValue(),'PRIVATE_DRAFT');
  await reveal(page,'settings');await reveal(page,'preview');await page.locator('[data-open=sample-1]').click();
  const backgrounds=new Set();
  for(const id of ids)for(const mode of ['light','dark']){
   await page.evaluate(({id,mode})=>{CardexTheme.setTheme(id);CardexTheme.set(mode);},{id,mode});
   const svg=await page.locator('.art-card').evaluate(el=>el.outerHTML);assert.ok(!svg.includes('PRIVATE_DRAFT'));assert.ok(!svg.includes('var(--'));
   backgrounds.add(await page.locator('.art-card > rect').first().getAttribute('fill'));
   const download=page.waitForEvent('download');await reveal(page,'download');const bytes=fs.readFileSync(await (await download).path());
   assert.equal(bytes.readUInt32BE(16),1080);assert.equal(bytes.readUInt32BE(20),1620);
   await reveal(page,'review-month');
   for(const kind of ['count','trend','distribution']){await page.locator('#stats-kind').selectOption(kind);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
   await reveal(page,'catalog');assert.equal(await page.locator('[data-stage]').count(),3);
   await reveal(page,'archive-records');await page.locator('[data-open=sample-1]').click();
  }
  assert.equal(backgrounds.size,18);
  await page.evaluate(()=>{localStorage.setItem('moment-card:diary-simple-v3:appearance','invalid');localStorage.setItem('moment-card:diary-simple-v3:color-scheme','invalid');});
  await page.reload();assert.equal(await page.evaluate(()=>CardexTheme.getTheme()),'lemon');assert.equal(await page.evaluate(()=>CardexTheme.getPreference()),'light');
  await page.evaluate(()=>{localStorage.setItem('moment-card:diary-simple-v3:appearance','sage');window.dispatchEvent(new StorageEvent('storage',{key:'moment-card:diary-simple-v3:appearance'}));});assert.equal(await page.getAttribute('html','data-appearance'),'sage');
  const blocked=await browser.newPage({offline:true});await blocked.addInitScript(()=>{Storage.prototype.getItem=Storage.prototype.setItem=()=>{throw Error('blocked');};});
  await blocked.goto(url);await blocked.waitForFunction(()=>DiaryReview.isReady());await reveal(blocked,'settings');await reveal(blocked,'theme-gallery');
  await blocked.locator('[data-theme-preview=sunset][data-mode=light]').click();await blocked.locator('[data-apply-theme]').click();assert.equal(await blocked.evaluate(()=>CardexTheme.getTheme()),'sunset');await blocked.close();
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
  console.log('PASS: 9 themes/18 palettes and PNGs, isolated preview/cancel/apply, OS-independent mode, 3 viewports, contrast, storage fallback and offline');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

// Soft UI v1.1 themes (2026-11-20): ten themes with one scheme each, picked directly in settings.
const {reveal,executablePath}=require('./browser-runtime.cjs');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.CARDEX_PLAYWRIGHT || path.join(os.tmpdir(),'aibootcamp-frontend-review/node_modules/playwright'));
const IDS=['clean','night','blossom','sage','mist','warm','grid','candy','tearoom','glass'];
const KEY='moment-card:diary-simple-v3:appearance';
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath});
 try {
  const page=await browser.newPage({offline:true,acceptDownloads:true});page.setDefaultTimeout(10000);
  const errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
  const url=pathToFileURL(path.resolve(__dirname,'../index.html')).href;
  await page.goto(url);await page.waitForFunction(()=>DiaryReview.isReady());
  assert.equal(await page.getAttribute('html','data-appearance'),'clean');
  assert.equal(await page.getAttribute('html','data-theme'),'light');
  await page.locator('#diary-text').fill('PRIVATE_DRAFT');
  // The avatar opens the profile/settings page, which holds the only theme picker (no mode switch, no preview dialog).
  await reveal(page,'settings');
  assert.equal(await page.locator('[data-color-mode], [data-theme-preview], #theme-dialog').count(),0);
  assert.equal(await page.locator('.avatar[aria-current=page]').count(),1);
  const ids=await page.evaluate(()=>CardexTheme.themes.map(t=>t.id));
  assert.deepEqual(ids,IDS);
  assert.equal(await page.locator('.theme-swatch[data-theme-id]').count(),10);
  for(const id of ids) {
   await page.locator(`.theme-swatch[data-theme-id=${id}]`).click();
   const scheme=await page.evaluate(id=>CardexTheme.themes.find(t=>t.id===id).scheme,id);
   assert.equal(await page.getAttribute('html','data-appearance'),id);
   assert.equal(await page.getAttribute('html','data-theme'),scheme);
   assert.equal(await page.locator('.theme-swatch[aria-current=true]').count(),1);
   assert.equal(await page.locator(`.theme-swatch[data-theme-id=${id}]`).getAttribute('aria-current'),'true');
   assert.equal(await page.locator(`.theme-swatch[data-theme-id=${id}]`).evaluate(e=>e===document.activeElement),true,'focus stays on the picked swatch');
   // Re-picking the current default writes nothing; every other pick is stored.
   const stored=await page.evaluate(k=>localStorage.getItem(k),KEY);
   assert.ok(stored===id || (id==='clean' && stored===null),`${id} stored as ${stored}`);
   // WCAG AA for text roles; the accent must also carry on-ink text.
   const ratios=await page.evaluate(()=>{
    const css=getComputedStyle(document.documentElement);
    const lum=n=>{const h=css.getPropertyValue(n).trim().slice(1);const rgb=[0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
    const r=(a,b)=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
    return [['--ink','--surface'],['--muted','--surface'],['--muted','--tint'],['--ink-bg','--paper'],['--muted-bg','--paper'],['--blue','--surface'],['--blue','--on-accent'],['--on-ink','--ink']].map(([a,b])=>[a+'/'+b,r(a,b)]);
   });
   for(const [pair,ratio] of ratios) assert.ok(ratio>=4.5,`${id}: ${pair} ${ratio.toFixed(2)}`);
   const body=await page.evaluate(()=>getComputedStyle(document.body).fontFamily);
   assert.match(body,/^"?Gothic A1"?/);
   for(const size of [{width:1366,height:768},{width:390,height:844},{width:320,height:568}]) {
    await page.setViewportSize(size);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${id} ${size.width}: no horizontal overflow`);
   }
   await page.setViewportSize({width:1366,height:768});
  }
  // Decorated themes paint their page background; clean stays plain white.
  const decor=await page.evaluate(ids=>ids.map(id=>{CardexTheme.setTheme(id);return [id,getComputedStyle(document.body).backgroundImage!=='none'];}),IDS);
  assert.deepEqual(Object.fromEntries(decor).clean,false);
  for(const id of ['candy','glass','mist','grid','tearoom']) assert.equal(Object.fromEntries(decor)[id],true,id+' decoration');
  // Figma F8 details on the record screen: grid page label + highlighter, tea room stitched panels, plain top bar.
  await reveal(page,'write');
  const detail=await page.evaluate(()=>Object.fromEntries(['grid','tearoom','clean'].map(id=>{CardexTheme.setTheme(id);const label=document.querySelector('.diary-page'),panel=document.querySelector('.panel'),head=getComputedStyle(document.querySelector('header'));return [id,{label:getComputedStyle(label).display!=='none'?label.textContent:'',mark:getComputedStyle(document.querySelector('.page-day')).backgroundImage!=='none',stitch:getComputedStyle(panel).outlineStyle,ring:head.boxShadow.includes('233, 195, 210')}];})));
  assert.match(detail.grid.label,/^p\. \d{1,3} · \d{4} diary$/,'grid page label');
  assert.equal(detail.grid.mark,true,'grid date highlighter');
  assert.deepEqual([detail.clean.label,detail.clean.mark,detail.tearoom.label],['',false,''],'label and highlighter only in grid');
  assert.equal(detail.tearoom.stitch,'dashed','tea room stitched border');
  assert.equal(detail.clean.stitch==='dashed',false);
  assert.equal(detail.tearoom.ring,false,'tea room top bar has no ring');
  await reveal(page,'settings');
  // OS color scheme never changes the theme.
  await page.emulateMedia({colorScheme:'dark'});await page.evaluate(()=>CardexTheme.setTheme('clean'));
  assert.equal(await page.getAttribute('html','data-theme'),'light');
  await page.reload();await page.waitForFunction(()=>DiaryReview.isReady());
  assert.equal(await page.locator('#diary-text').inputValue(),'PRIVATE_DRAFT');
  // Card art and PNG export work in every theme without leaking the draft.
  await reveal(page,'settings');await reveal(page,'preview');await page.locator('[data-open=sample-1]').click();
  for(const id of ids){
   await page.evaluate(id=>CardexTheme.setTheme(id),id);
   const svg=await page.locator('.art-card').evaluate(el=>el.outerHTML);assert.ok(!svg.includes('PRIVATE_DRAFT'));assert.ok(!svg.includes('var(--'));
   const download=page.waitForEvent('download');await reveal(page,'download');const bytes=fs.readFileSync(await (await download).path());
   assert.equal(bytes.readUInt32BE(16),1080);assert.equal(bytes.readUInt32BE(20),1512);
   await reveal(page,'review-month');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await reveal(page,'catalog');assert.equal(await page.locator('.slot[data-stage]').count(),27);
   await reveal(page,'archive-records');await page.locator('[data-open=sample-1]').click();
  }
  // Embedded fonts: Gothic A1 for Korean text, Bricolage Grotesque for the brand word.
  assert.equal(await page.evaluate(async()=>{await document.fonts.load('400 16px "Gothic A1"','오늘');return document.fonts.check('400 16px "Gothic A1"','오늘');}),true);
  assert.match(await page.locator('.brand-word').evaluate(el=>getComputedStyle(el).fontFamily),/^"?Bricolage Grotesque"?/);
  const license=await page.locator('#embedded-font-license').textContent();
  assert.ok(license.includes('HanYang I&C') && license.includes('Bricolage Grotesque Project Authors'));
  // Saved IDs from the previous theme set migrate; unknown values fall back to clean.
  for(const [stored,expected] of [['doodle','grid'],['starlight','night'],['editorial','clean'],['lemon','candy'],['doodlex','clean'],['','clean']]){
   await page.evaluate(([k,v])=>localStorage.setItem(k,v),[KEY,stored]);
   await page.reload();await page.waitForFunction(()=>DiaryReview.isReady());
   assert.equal(await page.evaluate(()=>CardexTheme.getTheme()),expected,stored);
  }
  await page.evaluate(k=>{localStorage.setItem(k,'sage');window.dispatchEvent(new StorageEvent('storage',{key:k}));},KEY);
  assert.equal(await page.getAttribute('html','data-appearance'),'sage');
  // Blocked storage: picking still works for the session.
  const blocked=await browser.newPage({offline:true});await blocked.addInitScript(()=>{Storage.prototype.getItem=Storage.prototype.setItem=Storage.prototype.removeItem=()=>{throw Error('blocked');};});
  await blocked.goto(url);await blocked.waitForFunction(()=>DiaryReview.isReady());await reveal(blocked,'settings');
  await blocked.locator('.theme-swatch[data-theme-id=night]').click();assert.equal(await blocked.evaluate(()=>CardexTheme.getTheme()),'night');
  assert.equal(await blocked.getAttribute('html','data-theme'),'dark');await blocked.close();
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
  console.log('PASS: 10 soft UI themes (one scheme each), direct swatch apply, AA contrast, decoration, migration, fonts, PNGs, 3 viewports, storage fallback and offline');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

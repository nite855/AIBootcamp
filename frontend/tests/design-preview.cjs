const assert=require('node:assert/strict');
const path=require('node:path');
const os=require('node:os');
const fs=require('node:fs');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.CARDEX_PLAYWRIGHT||path.join(os.tmpdir(),'aibootcamp-frontend-review/node_modules/playwright'));
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.CARDEX_CHROMIUM||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  try{
    const page=await browser.newPage({offline:true});const errors=[],requests=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
    await page.goto(pathToFileURL(path.resolve(__dirname,'../docs/design/preview/index.html')).href);
    assert.equal(await page.locator('#review-theme option').count(),10);
    assert.equal(await page.locator('[data-state]').count(),5);
    const evidence=path.join(os.tmpdir(),'aibootcamp-design-setup');fs.mkdirSync(evidence,{recursive:true});
    for(const id of await page.evaluate(()=>CardexTheme.themes.map(t=>t.id)))for(const mode of ['light','dark']){
      await page.locator('#review-theme').selectOption(id);await page.locator('#theme-preference').selectOption(mode);
      assert.equal(await page.getAttribute('html','data-appearance'),id);assert.equal(await page.getAttribute('html','data-theme'),mode);
      for(const width of [1366,390,320]){
        await page.setViewportSize({width,height:844});
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${id}/${mode}/${width}`);
      }
    }
    for(const width of [1366,390]){
      await page.setViewportSize({width,height:844});await page.screenshot({path:path.join(evidence,`preview-${width}.png`),fullPage:true});
    }
    for(const href of await page.locator('a').evaluateAll(as=>as.map(a=>a.href))) assert.ok(fs.existsSync(require('node:url').fileURLToPath(href)),href);
    assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
    console.log('Design preview: 18 palettes × 3 widths, offline, links OK. Evidence: '+evidence);
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

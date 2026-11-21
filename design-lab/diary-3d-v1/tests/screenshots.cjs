const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{pathToFileURL}=require('node:url');
const {chromium}=require(process.env.CARDEX_PLAYWRIGHT||path.join(os.tmpdir(),'aibootcamp-frontend-review/node_modules/playwright'));
(async()=>{
 const b=await chromium.launch({headless:true,executablePath:process.env.CARDEX_CHROMIUM||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const base=path.resolve(__dirname,'..'),out=path.join(base,'docs');
 try{
  const report=[];
  for(const variant of ['lemon','gray']){
   const browser=await b.newPage({offline:true,viewport:{width:1440,height:900}});
   await browser.goto(pathToFileURL(path.join(base,variant+'.html')).href);
   const dashboard=await browser.locator('.dashboard').boundingBox();assert.ok(dashboard&&dashboard.height>0,variant+' dashboard visible');
   const screens={dashboard:{visible:true}};
   await browser.screenshot({path:path.join(out,variant+'-dashboard-review.png'),fullPage:true});
   await browser.locator('[data-action=settings]').click();await browser.locator('[data-action=preview]').click();
   for(const [view,fn] of [
    
    ['card',async()=>{await browser.locator('[data-open=sample-1]').click();await browser.locator('[data-record-tab=card]').click();return browser.locator('.art-card');}],
    ['statistics',async()=>{await browser.locator('[data-action=history]').first().click();await browser.locator('[data-archive=stats]').click();return browser.locator('.stats-chart');}],
    ['catalog',async()=>{await browser.locator('[data-archive=catalog]').click();return browser.locator('.catalog-grid');}],
    ['settings',async()=>{await browser.locator('[data-action=settings]').click();return browser.locator('.settings-panel');}]
   ]){
     const el=await fn();const box=await el.boundingBox();screens[view]={visible:!!box&&box.width>0&&box.height>0};
     assert.ok(screens[view].visible,variant+' '+view+' visible');
     await browser.screenshot({path:path.join(out,variant+'-'+view+'-review.png'),fullPage:true});
    }
   report.push({variant,screens});await browser.close();
  }
  fs.writeFileSync(path.join(out,'screen-verification.json'),JSON.stringify(report,null,2));
  console.log('PASS: primary views captured for both variants',JSON.stringify(report));
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

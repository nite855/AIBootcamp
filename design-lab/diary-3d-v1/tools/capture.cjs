const path=require('node:path'),fs=require('node:fs'),os=require('node:os'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.CARDEX_PLAYWRIGHT||path.join(os.tmpdir(),'aibootcamp-frontend-review/node_modules/playwright'));
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.CARDEX_CHROMIUM||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  try{
    const page=await browser.newPage({offline:true,colorScheme:'light',viewport:{width:1440,height:900}});
    const out=path.resolve(__dirname,'../docs/previews');fs.mkdirSync(out,{recursive:true});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);
    await page.evaluate(()=>document.fonts.ready);
    const shot=async name=>page.screenshot({path:path.join(out,name+'.png')});
    await shot('write-desktop');
    await page.setViewportSize({width:375,height:844});await shot('write-mobile');
    await page.locator('[data-action=settings]').click();await shot('settings-mobile');
    await page.locator('[data-action=preview]').click();
    await page.locator('[data-open=sample-1]').click();await page.locator('[data-record-tab=card]').click();
    await shot('card-mobile');await page.setViewportSize({width:1440,height:900});await shot('card-desktop');
    await page.evaluate(()=>CardexTheme.set('dark'));await shot('card-dark');
    await page.locator('[data-action=history]').first().click();await page.locator('[data-archive=stats]').click();await shot('statistics-desktop');
    // Opaque content: verify text and meaningful boundaries against their surfaces.
    const contrast=await page.evaluate(()=>{
      const css=getComputedStyle(document.documentElement);
      const l=n=>{const h=css.getPropertyValue(n).trim().slice(1);const a=[0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return a[0]*.2126+a[1]*.7152+a[2]*.0722;};
      return ['--paper','--surface'].flatMap(bg=>['--ink','--muted','--line'].map(fg=>({fg,bg,ratio:(Math.max(l(fg),l(bg))+.05)/(Math.min(l(fg),l(bg))+.05)})));
    });
    assert.ok(contrast.every(x=>x.ratio>=(x.fg==='--line'?3:4.5)));
    assert.deepEqual(errors,[]);console.log(JSON.stringify({contrast,errors,screenshots:7}));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});


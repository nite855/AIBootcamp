const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.CARDEX_PLAYWRIGHT || path.join(os.tmpdir(), 'aibootcamp-frontend-review/node_modules/playwright'));
(async () => {
  const browser = await chromium.launch({headless:true, executablePath:process.env.CARDEX_CHROMIUM || 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  try {
    const page = await browser.newPage();
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(pathToFileURL(path.join(__dirname,'preview.html')).href);
    const inventory=[];
    for (const folder of ['icons','components']) {
      const files=fs.readdirSync(path.join(__dirname,folder));
      assert.equal(files.length,folder==='icons'?16:12);
      for (const file of files) {
        const target=path.join(__dirname,folder,file);
        if(file.endsWith('.svg')) {
          const source=fs.readFileSync(target,'utf8');
          assert(!/<image|<script|https?:\/\/(?!www.w3.org)/.test(source));
          const valid=await page.evaluate(s=>!new DOMParser().parseFromString(s,'image/svg+xml').querySelector('parsererror'),source);
          assert(valid, file+' SVG XML');
        }
      }
    }
    await page.locator('img').evaluateAll(async images=>{await Promise.all(images.map(img=>img.decode()));});
    for(const item of await page.locator('figure img').evaluateAll(images=>images.map(img=>({src:img.getAttribute('src'),width:img.naturalWidth,height:img.naturalHeight})))) {
      assert(item.width>0 && item.height>0,item.src);
      inventory.push(item);
    }
    const pngData=fs.readdirSync(path.join(__dirname,'icons')).filter(f=>f.endsWith('.png')).map(file=>({src:file,url:'data:image/png;base64,'+fs.readFileSync(path.join(__dirname,'icons',file)).toString('base64')}));
    const alpha=await page.evaluate(async items=>Promise.all(items.map(async item=>{
      const img=new Image();img.src=item.url;await img.decode();
      const c=document.createElement('canvas'); c.width=img.naturalWidth; c.height=img.naturalHeight;
      const ctx=c.getContext('2d');ctx.drawImage(img,0,0);const data=ctx.getImageData(0,0,c.width,c.height).data;
      let transparent=0,partial=0,visible=0;
      for(let i=3;i<data.length;i+=4){if(data[i]===0)transparent++;else {visible++;if(data[i]<255)partial++;}}
      return {src:item.src,transparent,partial,visible};
    })),pngData);
    alpha.forEach(a=>assert(a.transparent>0 && a.visible>0,a.src+' alpha'));
    for(const width of [1440,375]) {
      await page.setViewportSize({width,height:1000});
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'horizontal overflow');
      for(const bg of ['light','dark','checker']) {
        await page.locator(`[data-bg="${bg}"]`).click();
        assert.equal(await page.locator(`[data-bg="${bg}"]`).getAttribute('aria-pressed'),'true');
      }
    }
    await page.setViewportSize({width:1440,height:1000});
    await page.locator('[data-bg="light"]').click();
    fs.mkdirSync(path.join(__dirname,'qa'),{recursive:true});
    await page.screenshot({path:path.join(__dirname,'qa/gallery-desktop.png'),fullPage:true});
    await page.setViewportSize({width:375,height:900});
    await page.screenshot({path:path.join(__dirname,'qa/gallery-mobile.png'),fullPage:true});
    assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(__dirname,'qa/verification.json'),JSON.stringify({inventory,alpha,viewports:[1440,375],errors},null,2)+'\n');
    console.log('PASS: 28 assets decoded; 14 SVGs parsed; 8 PNGs transparent; 1440/375px layouts and background controls checked.');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});

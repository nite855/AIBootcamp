const {chromium}=require(require('node:path').join(require('node:os').tmpdir(),'aibootcamp-frontend-review/node_modules/playwright'));
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(path.join(__dirname,'index.html')).href);
  const refs=await page.locator('a[href],img[src]').evaluateAll(els=>els.map(x=>x.getAttribute('href')||x.getAttribute('src')));
  for(const ref of refs)if(!ref.startsWith('#'))assert.ok(fs.existsSync(path.resolve(__dirname,ref)),ref);
  assert.equal(await page.locator('#matrix tbody tr').count(),8);
  assert.equal(await page.locator('.project').count(),8);
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:1400});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  }
  await page.setViewportSize({width:1440,height:1500});
  await page.screenshot({path:path.join(__dirname,'comparison-table.png')});
  assert.deepEqual(errors,[]);
  const audit=JSON.parse(fs.readFileSync(path.join(__dirname,'audit.json'),'utf8'));
  await page.setContent('<html><body style="margin:0;background:#e8edf1"><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px">'+audit.results.map(r=>'<div style="min-width:0;font:12px sans-serif">'+r.name+'<img style="width:100%;height:720px;object-fit:cover;object-position:top" src="'+pathToFileURL(path.join(__dirname,'screenshots',r.name+'-390.png')).href+'"></div>').join('')+'</div></body></html>');
  await page.evaluate(()=>Promise.all([...document.images].map(im=>im.decode())));
  await page.screenshot({path:path.join(__dirname,'mobile-contact-sheet.png'),fullPage:true});
  console.log('PASS: 8 project rows, 8 screenshot cards, all local links, report widths 1440/390, no JS errors.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});

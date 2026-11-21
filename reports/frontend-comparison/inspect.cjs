const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {spawnSync}=require('node:child_process');
const {pathToFileURL}=require('node:url');
const {chromium}=require(path.join(os.tmpdir(),'aibootcamp-frontend-review/node_modules/playwright'));
const root=path.resolve(__dirname,'../..'),out=__dirname;
// Keep the report's original comparison set; archived MVPs and the main frontend are separate.
const projectNames=JSON.parse(fs.readFileSync(path.join(out,'audit.json'),'utf8')).results.map(row=>row.name);
fs.mkdirSync(path.join(out,'screenshots'),{recursive:true});
fs.mkdirSync(path.join(out,'logs'),{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const results=[];
 try {for(const name of projectNames){
  const dir=path.join(root,'design-lab',name);if(!fs.existsSync(path.join(dir,'index.html')))continue;
  const tests=fs.readdirSync(path.join(dir,'tests')).filter(n=>n.endsWith('.test.cjs')&&n!=='social.test.cjs');
  const run=spawnSync(process.execPath,['--test','--test-reporter=tap',...tests.map(t=>path.join(dir,'tests',t))],{encoding:'utf8'});
  fs.writeFileSync(path.join(out,'logs',name+'.txt'),run.stdout+run.stderr);
  const count=k=>Number(run.stdout.match(new RegExp('^# '+k+' (\\d+)','m'))?.[1]||0);
  const sources=['scripts','styles','templates'].flatMap(d=>fs.existsSync(path.join(dir,d))?fs.readdirSync(path.join(dir,d)).filter(f=>/\.(js|css|html)$/.test(f)&&f!=='fonts.css').map(f=>path.join(dir,d,f)):[]);
  const entry=fs.readFileSync(path.join(dir,'index.html'),'utf8');
  const row={name,htmlKiB:Math.round(Buffer.byteLength(entry)/1024),sourceFiles:sources.length,sourceLines:sources.reduce((n,f)=>n+fs.readFileSync(f,'utf8').split('\n').length,0),tests:count('tests'),pass:count('pass'),fail:count('fail'),screens:[]};
  const context=await browser.newContext({colorScheme:'light'}),page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:1000});
   await page.goto(pathToFileURL(path.join(dir,'index.html')).href);
   await page.evaluate(()=>document.fonts.ready);
   if(width===1440)await page.screenshot({path:path.join(out,'screenshots',name+'-input.png')});
   if(name.startsWith('diary-')){await page.evaluate(()=>window.DiaryApp.fixture('multi'));await page.waitForTimeout(150);}
   else await page.goto(pathToFileURL(path.join(dir,'index.html')).href+'?preview=overview');
   await page.evaluate(()=>document.fonts.ready);
   const info=await page.evaluate(()=>({heading:document.querySelector('h1')?.textContent,overflow:document.documentElement.scrollWidth>innerWidth,scrollWidth:document.documentElement.scrollWidth}));
   await page.screenshot({path:path.join(out,'screenshots',name+'-'+width+'.png'),fullPage:true});
   row.screens.push({width,...info});
  }
  row.browserErrors=errors;await context.close();results.push(row);console.log(JSON.stringify(row));
 }}finally{await browser.close();fs.writeFileSync(path.join(out,'audit.json'),JSON.stringify({date:'2026-11-03',scope:'Light theme, entry and fixture overview only; not full E2E',results},null,2));}
})().catch(e=>{console.error(e);process.exitCode=1});

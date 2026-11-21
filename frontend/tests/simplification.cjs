const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const {pathToFileURL} = require('node:url');
const {chromium} = require(process.env.CARDEX_PLAYWRIGHT || path.join(os.tmpdir(),'aibootcamp-frontend-review/node_modules/playwright'));
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CARDEX_CHROMIUM || 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try {
  const p=await browser.newPage({offline:true}); const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);await p.waitForFunction(()=>DiaryReview.isReady());
  assert.equal(await p.locator('[data-action=retry-save]').isVisible(),false);
  await require('./browser-runtime.cjs').reveal(p,'settings'); await p.locator('[data-action=preview]').evaluate(el=>el.closest('details').open=true);await p.locator('[data-action=preview]').click();await p.locator('[data-open=sample-1]').click();
  for(const size of [{width:1366,height:768},{width:1440,height:900},{width:390,height:844},{width:375,height:667},{width:360,height:640},{width:320,height:568}]) {
   await p.setViewportSize(size);await p.waitForFunction(()=>parseInt(document.documentElement.style.getPropertyValue('--app-height'))===innerHeight);
   let baseline;
   for(const id of await p.evaluate(()=>CardexTheme.themes.map(t=>t.id))) for(const mode of ['light','dark']) {
    await p.evaluate(({id,mode})=>{CardexTheme.setTheme(id);CardexTheme.set(mode);},{id,mode});
    await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const boxes=await p.locator('.flip-scene').evaluate(el=>['.art-card','.flip-light','.flip-back'].map(s=>{const r=el.querySelector(s).getBoundingClientRect();return [r.x,r.y,r.width,r.height]}));
    for(const box of boxes.slice(1)) boxes[0].forEach((v,i)=>assert.ok(Math.abs(v-box[i])<=1,`${id}/${mode} bounds`));
    if(!baseline)baseline=boxes[0];
    baseline.forEach((v,i)=>assert.ok(Math.abs(v-boxes[0][i])<=1,`${id}/${mode} theme geometry`));
    assert.equal(await p.locator('.card-actions > button').count(),3);
    assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   }
  }
  const open=()=>p.locator('[popovertarget=card-more]').click();
  await open();await p.keyboard.press('Escape');assert.equal(await p.locator('#card-more').isVisible(),false);
  await open();await p.locator('[data-action=delete-example]').click();assert.equal(await p.locator('[data-confirm=cancel]').evaluate(el=>el===document.activeElement),true);await p.keyboard.press('Escape');assert.equal(await p.evaluate(()=>DiaryReview.getState().selected),'sample-1');
  await open();await p.locator('[data-action=edit-example]').click();await p.locator('#sample-text').fill('discarded');await p.locator('[data-action=cancel-edit]').click();
  await p.locator('[data-action=read-full]').click();assert.ok(!(await p.locator('.full-text').textContent()).includes('discarded'));await p.keyboard.press('Escape');
  await p.screenshot({path:path.join(os.tmpdir(),'moment-simple-mobile.png')});
  await p.setViewportSize({width:1366,height:768});await p.waitForTimeout(150);await p.screenshot({path:path.join(os.tmpdir(),'moment-simple-desktop.png')});
  assert.deepEqual(errors,[]);console.log('PASS: 108 theme/viewport geometries, three actions, Escape, delete cancel, edit cancel, retry visibility');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});

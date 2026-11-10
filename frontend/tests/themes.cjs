async function reveal(page, action) {
  const target = page.locator(`[data-action="${action}"]`).first();
  await target.evaluate(el => { for(let p=el.parentElement;p;p=p.parentElement) if(p.tagName==='DETAILS') p.open=true; });
  const pop = await target.evaluate(el => el.closest('[popover]')?.id);
  if(pop && !await target.isVisible()) await page.locator(`[popovertarget="${pop}"]`).click();
  await target.click();
}
﻿const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {pathToFileURL} = require('node:url');
const {chromium} = require(process.env.CARDEX_PLAYWRIGHT || path.join(os.tmpdir(),'aibootcamp-frontend-review/node_modules/playwright'));
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.CARDEX_CHROMIUM || 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  try {
    const page=await browser.newPage({offline:true,acceptDownloads:true});
    const errors=[],requests=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
    const url=pathToFileURL(path.resolve(__dirname,'../index.html')).href;
    await page.goto(url);
    await page.locator('#diary-text').fill('PRIVATE_DRAFT');
    await page.locator('[data-action=settings]').click();
    assert.equal(await page.locator('[name=appearance]').count(),6);
    const ids=await page.evaluate(()=>CardexTheme.themes.map(t=>t.id));
    assert.equal(new Set(ids).size,6);
    assert.equal(await page.evaluate(()=>CardexTheme.themes.some(t=>t.name.includes('?'))),false);
    for(const id of ids){
      await page.locator(`[name=appearance][value=${id}]`).check();
      for(const mode of ['light','dark']){
        await page.locator(`[name=color-mode][value=${mode}]`).check();
        assert.equal(await page.getAttribute('html','data-appearance'),id);
        assert.equal(await page.getAttribute('html','data-theme'),mode);
        const icons=await page.locator('header .icon').evaluateAll(buttons=>buttons.map(button=>{
          const svg=button.querySelector('svg');
          const box=button.getBoundingClientRect();
          return {width:box.width,height:box.height,stroke:svg && getComputedStyle(svg).stroke,
            color:getComputedStyle(button).color,iconWidth:svg && svg.getBoundingClientRect().width};
        }));
        assert.equal(icons.length,2);
        for(const icon of icons){
          assert.equal(icon.width,44);assert.equal(icon.height,44);assert.equal(icon.iconWidth,24);
          assert.equal(icon.stroke,icon.color);assert.notEqual(icon.stroke,'none');
        }
        const contrasts=await page.evaluate(()=>{
          const css=getComputedStyle(document.documentElement);
          const luminance=name=>{
            const hex=css.getPropertyValue(name).trim().slice(1);
            const rgb=[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
            return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
          };
          return [['--ink','--surface'],['--muted','--surface'],['--ink','--paper'],['--muted','--paper'],['--blue','--on-accent']].map(([a,b])=>{
            const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
          });
        });
        assert.ok(contrasts.every(v=>v>=4.5),`${id}/${mode} text contrast: ${contrasts}`);
        for(const size of [{width:1366,height:768},{width:1440,height:900},{width:390,height:844},{width:360,height:640},{width:320,height:568}]){
          await page.setViewportSize(size); await page.waitForFunction(()=>parseInt(document.documentElement.style.getPropertyValue("--app-height"))===innerHeight);
          assert.equal(await page.evaluate(()=>JSON.stringify({w:document.documentElement.scrollWidth,h:document.documentElement.scrollHeight,iw:innerWidth,ih:innerHeight})),JSON.stringify({w:size.width,h:size.height,iw:size.width,ih:size.height}));
          await page.locator('details').first().evaluate(el=>el.open=true);
          await page.locator('.settings-panel .panel-body').evaluate(el=>el.scrollTop=el.scrollHeight);
          assert.ok(await page.locator('[name=policy]').last().isVisible());
        }
        await page.locator('[name=color-mode][value=system]').check();
        await page.emulateMedia({colorScheme:mode}); await page.waitForFunction(m=>document.documentElement.dataset.theme===m,mode);
        assert.equal(await page.getAttribute('html','data-theme'),mode);
      }
    }
    await page.locator('.settings-panel .panel-body').evaluate(el=>el.scrollTop=0);
    await page.screenshot({path:path.join(os.tmpdir(),'diary-themes-settings.png')});
    await page.locator('[data-action=write]').first().click();
    assert.equal(await page.locator('#diary-text').inputValue(),'PRIVATE_DRAFT');
    await page.locator('[data-action=settings]').click();
    await reveal(page,'preview');
    await page.locator('[data-open=sample-1]').click();
    await page.locator('.flip-trigger').waitFor();
    const backgrounds=new Set();
    for(const id of ids)for(const mode of ['light','dark']){
      await page.evaluate(({id,mode})=>{CardexTheme.setTheme(id);CardexTheme.set(mode);},{id,mode});
      const svg=await page.locator('.art-card').evaluate(el=>el.outerHTML);
      assert.ok(!svg.includes('PRIVATE_DRAFT'));
      assert.ok(!svg.includes('var(--'));
      backgrounds.add(await page.locator('.art-card > rect').first().getAttribute('fill'));
      const download=page.waitForEvent('download');
      await page.locator('[data-action=download]').click();
      const bytes=fs.readFileSync(await (await download).path());
      assert.equal(bytes.readUInt32BE(16),1080);assert.equal(bytes.readUInt32BE(20),1620);
      await page.locator('[data-action=history]').first().click();
      await page.locator('[data-archive=stats]').click();
      for(const tab of ['trend','count','distribution']){
        await page.locator('#stats-kind').selectOption(tab);
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth || document.documentElement.scrollHeight>innerHeight+1),false);
      }
      await page.locator('[data-archive=catalog]').click();
      assert.equal(await page.locator('[data-stage]').count(),3);
      await page.locator('[data-archive=records]').click();
      await page.locator('[data-open=sample-1]').click();
      await page.locator('.flip-trigger').waitFor();
    }
    assert.equal(backgrounds.size,12);
    await page.screenshot({path:path.join(os.tmpdir(),'diary-themes-card.png')});
    await page.evaluate(()=>{CardexTheme.setTheme('retro');CardexTheme.set('dark');});
    await page.reload();
    assert.equal(await page.getAttribute('html','data-appearance'),'retro');
    assert.equal(await page.getAttribute('html','data-theme'),'dark');
    assert.equal(await page.evaluate(()=>DiaryReview.getState().sessions.length),0);
    await page.evaluate(()=>{localStorage.setItem('moment-card:diary-simple-v3:appearance','invalid');localStorage.setItem('moment-card:diary-simple-v3:color-scheme','invalid');});
    await page.reload();
    assert.equal(await page.getAttribute('html','data-appearance'),'lemon');
    assert.equal(await page.evaluate(()=>CardexTheme.getPreference()),'light');
    await page.evaluate(()=>{localStorage.setItem('moment-card:diary-simple-v3:appearance','sage');window.dispatchEvent(new StorageEvent('storage',{key:'moment-card:diary-simple-v3:appearance'}));});
    assert.equal(await page.getAttribute('html','data-appearance'),'sage');
    await page.evaluate(()=>{localStorage.clear();window.dispatchEvent(new StorageEvent('storage',{key:null}));});
    assert.equal(await page.getAttribute('html','data-appearance'),'lemon');
    const blocked=await browser.newPage();
    await blocked.addInitScript(()=>{Storage.prototype.getItem=Storage.prototype.setItem=()=>{throw Error('blocked');};});
    await blocked.goto(url);
    await blocked.evaluate(()=>{CardexTheme.setTheme('sage');CardexTheme.set('dark');CardexTheme.setTheme('invalid');});
    assert.equal(await blocked.getAttribute('html','data-appearance'),'sage');
    await blocked.close();
    assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
    console.log('PASS: 6 themes, 12 palettes/PNGs, 5 viewports, system mode, draft, persistence, invalid/blocked storage, offline');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

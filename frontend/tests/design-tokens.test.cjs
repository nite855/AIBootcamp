const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const load = n => JSON.parse(fs.readFileSync(path.join(__dirname,`../design/tokens/${n}.json`),'utf8'));
const compiler = import('../tools/build-tokens.mjs');
const IDS = ['clean','night','blossom','sage','mist','warm','grid','candy','tearoom','glass'];

test('soft UI v1.1 themes resolve with one scheme each and generated tokens are current',async()=>{
  const {compileTokens,buildTokens} = await compiler;
  const {css,script} = compileTokens(load('primitives'),load('semantic'),load('themes'));
  assert.equal((css.match(/:root\[data-appearance=/g)||[]).length,10);
  assert.doesNotMatch(css,/\[data-theme=/);
  const context = {window:{}}; vm.runInNewContext(script,context);
  const themes = context.window.CardexDesignThemes;
  assert.deepEqual(Array.from(themes,t=>t.id),IDS);
  const clean = themes[0];
  assert.equal(clean.name,'클린 화이트');
  assert.equal(clean.scheme,'light');
  // Figma Diary v1.1 / Clean: bg, surface, ink, ink2, accent, on-ink, soft, line.
  assert.deepEqual(Array.from(clean.colors),['#ffffff','#ffffff','#111114','#5f5f68','#3b5bfd','#ffffff','#f7f7f8','#f0f0f2']);
  assert.deepEqual(Array.from(themes.filter(t=>t.scheme==="dark"),t=>t.id),["night"]);
  // Tea room is a light scheme (light panels and controls) on a dark page: titles use the on-background text role.
  assert.match(css,/data-appearance="tearoom"\][^}]*--color-text-bg:#f7f1ec;[^}]*/);
  assert.match(css,/data-appearance="tearoom"\][^}]*--color-text:#3a2f31;/);
  // Emotion card colors are fixed across themes (Figma Emotion Card v0.9).
  assert.match(css,/:root\{[^}]*--card-base-pos-1:#ffb3c7;[^}]*--card-deep-neu-3:#d97cc6;/);
  assert.match(css,/--font-ui:"Gothic A1", sans-serif;/);
  await buildTokens({check:true});
});

test('missing references, cycles, unsafe values, bad schemes and a missing default fail generation',async()=>{
  const {compileTokens} = await compiler;
  for (const extra of [{bad:'{missing}'},{a:'{b}',b:'{a}'}]) {
    assert.throws(()=>compileTokens(load('primitives'),{...load('semantic'),...extra},load('themes')),/Missing|Circular/);
  }
  const primitives=load('primitives');primitives['space-4'].value='4px;}body{display:none';
  assert.throws(()=>compileTokens(primitives,load('semantic'),load('themes')),/Invalid/);
  const noMode=load('themes');noMode.themes[0].modes={};
  assert.throws(()=>compileTokens(load('primitives'),load('semantic'),noMode),/Missing mode/);
  const badScheme=load('themes');badScheme.themes[0].scheme='system';
  assert.throws(()=>compileTokens(load('primitives'),load('semantic'),badScheme),/Invalid scheme/);
  const extraMode=load('themes');extraMode.themes[0].modes.dark=extraMode.themes[0].modes.light;
  assert.throws(()=>compileTokens(load('primitives'),load('semantic'),extraMode),/Extra mode/);
  const missingRole=load('themes');delete missingRole.themes[1].modes.dark['color-text-bg'];
  assert.throws(()=>compileTokens(load('primitives'),load('semantic'),missingRole),/Missing token/);
  const duplicate=load('themes');duplicate.themes.push(duplicate.themes[0]);
  assert.throws(()=>compileTokens(load('primitives'),load('semantic'),duplicate),/duplicate/);
  const noDefault=load('themes');noDefault.themes = noDefault.themes.filter(t=>t.id !== 'clean');
  assert.throws(()=>compileTokens(load('primitives'),load('semantic'),noDefault),/Missing default/);
});

test('saved legacy theme IDs migrate to the closest soft UI theme',()=>{
  const {script} = {script:fs.readFileSync(path.join(__dirname,'../scripts/generated/theme-tokens.js'),'utf8')};
  const themeJs = fs.readFileSync(path.join(__dirname,'../scripts/theme.js'),'utf8');
  const run = stored => {
    const storage = new Map(Object.entries(stored));
    const root = {dataset:{},style:{}};
    const context = {
      window:{addEventListener(){},dispatchEvent(){}},
      Event:class{},
      localStorage:{getItem:k=>storage.has(k)?storage.get(k):null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)},
      document:{documentElement:root,querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){}},
    };
    vm.runInNewContext(script+'\n'+themeJs,context);
    return {theme:root.dataset.appearance,scheme:root.dataset.theme,storage,api:context.window.CardexTheme};
  };
  const key='moment-card:diary-simple-v3:appearance';
  const expected={paper:'warm',retro:'warm',sunset:'warm',editorial:'clean',aurora:'glass',lemon:'candy',forest:'sage',starlight:'night',doodle:'grid',blossom:'blossom',sage:'sage'};
  for (const [old,next] of Object.entries(expected)) {
    const result = run({[key]:old});
    assert.equal(result.theme,next,old);
    assert.equal(result.storage.get(key),next,`${old} is rewritten`);
  }
  // No value, an unknown value and garbage fall back to the default.
  for (const stored of [{},{[key]:'unknown'},{[key]:''}]) assert.equal(run(stored).theme,'clean');
  // Scheme follows the theme; the old light/dark key is dropped.
  const night = run({[key]:'starlight','moment-card:diary-simple-v3:color-scheme':'light'});
  assert.equal(night.scheme,'dark');
  assert.equal(night.storage.has('moment-card:diary-simple-v3:color-scheme'),false);
  assert.equal(run({[key]:"tearoom"}).scheme,"light");
  assert.equal(run({[key]:'clean'}).api.getPreference(),'light');
});

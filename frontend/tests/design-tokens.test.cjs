const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const load = n => JSON.parse(fs.readFileSync(path.join(__dirname,`../design/tokens/${n}.json`),'utf8'));
const compiler = import('../tools/build-tokens.mjs');
test('all existing themes resolve and generated tokens are current',async()=>{
  const {compileTokens,buildTokens} = await compiler;
  const {css,script} = compileTokens(load('primitives'),load('semantic'),load('themes'));
  assert.equal((css.match(/:root\[data-appearance=/g)||[]).length,18);
  const context = {window:{}}; require('node:vm').runInNewContext(script,context);
  assert.deepEqual(Array.from(context.window.CardexDesignThemes,t=>t.id),['paper','sage','aurora','editorial','retro','lemon','forest','sunset','starlight']);
  assert.equal(context.window.CardexDesignThemes[0].light[0],'#f5f0e6');
  await buildTokens({check:true});
});
test('missing references, cycles, unsafe values and absent modes fail generation',async()=>{
  const {compileTokens} = await compiler;
  for (const extra of [{bad:'{missing}'},{a:'{b}',b:'{a}'}]) {
    assert.throws(()=>compileTokens(load('primitives'),{...load('semantic'),...extra},load('themes')),/Missing|Circular/);
  }
  const primitives=load('primitives');primitives['space-4'].value='4px;}body{display:none';
  assert.throws(()=>compileTokens(primitives,load('semantic'),load('themes')),/Invalid/);
  const themes=load('themes');delete themes.themes[0].modes.dark;
  assert.throws(()=>compileTokens(load('primitives'),load('semantic'),themes),/Missing mode/);
  const duplicate=load('themes');duplicate.themes.push(duplicate.themes[0]);
  assert.throws(()=>compileTokens(load('primitives'),load('semantic'),duplicate),/duplicate/);
  const noDefault=load('themes');noDefault.themes = noDefault.themes.filter(t=>t.id !== 'lemon');
  assert.throws(()=>compileTokens(load('primitives'),load('semantic'),noDefault),/Missing default/);
});

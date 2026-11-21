const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root=path.resolve(__dirname,'..');
const read = p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const validator=import('../tools/design-validation.mjs');
test('26 original screen IDs, links and generated manifest agree',async()=>{
  const d=read('design/wireframes/screens.json');(await validator).validateScreens(d);
  assert.equal(d.screens.length,26);
  assert.deepEqual(d.screens.map(({id,title,type,state})=>({id,title,type,state})),read('docs/wireframes/manifest.json').screens);
  for(const s of d.screens) for(const device of ['desktop','mobile']) {
    const svg=fs.readFileSync(path.join(root,`docs/wireframes/svg/${device}/${s.id}.svg`),'utf8');
    const actual=[...new Set([...svg.matchAll(/data-target="([^"]+)"/g)].map(m=>m[1]))].sort();
    assert.deepEqual(actual,s.actions.filter(a=>a.devices.includes(device)).map(a=>a.target).sort(),s.id);
  }
});
test('duplicate IDs, invalid destinations and unsupported frame sizes are rejected',async()=>{
  const {validateScreens}=await validator;
  for(const mutate of [d=>d.screens.push(d.screens[0]),d=>d.screens[0].actions.push({target:'WF-99'}),d=>d.devices.mobile[0]=320]) {
    const d=read('design/wireframes/screens.json');mutate(d);assert.throws(()=>validateScreens(d));
  }
});
test('fixture data is synthetic, assets resolve, and all 30 slots remain explicit',()=>{
  assert.equal(read('design/fixtures/ui-states.json').synthetic,true);
  const {assets,characterSlots}=read('design/assets/manifest.json');
  assert.equal(characterSlots.length,30);assert.equal(new Set(characterSlots.map(s=>s.id)).size,30);
  for(const asset of [...assets,...characterSlots]) for(const key of ['path','license']) if(asset[key]) assert.ok(fs.existsSync(path.join(root,asset[key])),asset[key]);
});
test('new design document links point to existing local files and Korean text is intact',()=>{
  const files=fs.readdirSync(path.join(root,'docs/design')).filter(n=>n.endsWith('.md')).map(n=>`docs/design/${n}`);
  files.push('docs/UI_SPEC.md','docs/ARCHITECTURE.md','docs/ROADMAP.md','docs/QA.md');
  for(const p of files){
    const text=fs.readFileSync(path.join(root,p),'utf8');
    assert.ok(!/\?{3}|\uFFFD/.test(text),p);
    for(const [,href] of text.matchAll(/\]\(([^)]+)\)/g)) if(!/^(https?:|#)/.test(href)) assert.ok(fs.existsSync(path.resolve(root,path.dirname(p),href.split('#')[0])),`${p}: ${href}`);
  }
  assert.ok(!/\?{3}|\uFFFD/.test(JSON.stringify(read('design/wireframes/screens.json'))));
});

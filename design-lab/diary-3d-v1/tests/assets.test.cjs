const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=path.resolve(__dirname,'..');
test('all seven emotions and two decorations have transparent PNG sources',()=>{
 for(const id of ['pos_1','pos_2','pos_3','neg_1','neg_2','neg_3','neutral','heart','star']){
  const png=fs.readFileSync(path.join(base,'assets',id+'.png'));
  assert.equal(png.subarray(1,4).toString(),'PNG',id);
  assert.ok(png.readUInt32BE(16)>0&&png.readUInt32BE(20)>0,id);
  assert.ok([4,6].includes(png[25]),id+' must preserve alpha');
 }
});
test('both standalone builds embed all assets and isolate their settings',()=>{
 for(const id of ['lemon','gray']){
  const html=fs.readFileSync(path.join(base,id+'.html'),'utf8');
  assert.ok(html.includes('"id":"'+id+'"'));
  assert.ok(html.includes('moment-card:diary-3d-v1:'));
  assert.ok(!html.includes('/*__OBJECT_ASSETS__*/'));
  for(const asset of ['pos_1','pos_2','pos_3','neg_1','neg_2','neg_3','neutral','heart','star'])assert.ok(html.includes('"'+asset+'":"data:image/png;base64,'));
  assert.ok(!html.includes('name="reduce-glass"'));
  assert.ok(!html.includes('mcp.figma.com'));
 }
});

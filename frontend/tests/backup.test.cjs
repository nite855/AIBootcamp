const {test}=require('node:test');
const assert=require('node:assert/strict');
const B=require('../scripts/backup.js');
const entry=(id='a',extra={})=>({id,text:'산책한 날 🌿',recordDate:'2026-11-10',version:1,
  createdAt:'2026-11-10T12:00:00Z',updatedAt:'2026-11-10T12:00:00Z',favorite:true,...extra});
test('roundtrip retains favorite and excludes analysis, drafts and settings',()=>{
  const file=B.create([entry('a',{analysis:{status:'valid'}})]);
  assert.deepEqual(Object.keys(file).sort(),['entries','exportedAt','format','version']);
  assert.equal('analysis' in file.entries[0],false);
  assert.deepEqual(B.parse(JSON.stringify(file)),[entry()]);
});
test('merge adds new entries, skips exact duplicates and blocks conflicting versions',()=>{
  const a=entry(), b=entry('b');
  const result=B.merge([a],[a,b]);
  assert.equal(result.added,1); assert.equal(result.duplicates,1); assert.equal(result.allowed,true);
  assert.equal(B.merge([a],[entry('a',{favorite:false})]).allowed,false);
  assert.deepEqual(a,entry());
});
test('bad JSON, unsupported versions, malformed records and duplicate IDs rejected',()=>{
  assert.throws(()=>B.parse('{'));
  for(const data of [null,{}, {...B.create([]),version:2},
    {...B.create([]),entries:[entry(),entry()]},
    {...B.create([]),entries:[entry('a',{recordDate:'2026-02-30'})]},
    {...B.create([]),entries:[entry('a',{favorite:'yes'})]},
    {...B.create([]),entries:[entry('a',{text:'x'.repeat(10001)})]}])
    assert.throws(()=>B.parse(JSON.stringify(data)));
  assert.throws(()=>B.parse(' '.repeat(B.MAX_BYTES+1)));
});
test('over-limit merged result is rejected without mutating inputs',()=>{
  const current=Array.from({length:30},(_,i)=>entry('id-'+i));
  const result=B.merge(current,[entry('new')]);
  assert.equal(result.allowed,false); assert.equal(result.overLimit,true); assert.equal(current.length,30);
});
test('legacy missing favorite defaults false, literal markup survives as text',()=>{
  const old=entry(); delete old.favorite;
  assert.equal(B.parse(JSON.stringify(B.create([old])))[0].favorite,false);
  assert.equal(B.parse(JSON.stringify(B.create([entry('a',{text:'<img src=x onerror=alert(1)>'})])))[0].text,'<img src=x onerror=alert(1)>');
});

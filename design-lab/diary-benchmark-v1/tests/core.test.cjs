const test=require('node:test');
const assert=require('node:assert/strict');
const C=require('../scripts/core.js');
const p={pos_1:.18,pos_2:.15,pos_3:.12,neg_1:.25,neg_2:.09,neg_3:.06,neu_1:.06,neu_2:.03,neu_3:.03,neu_4:.03};
const row=(anchor,probabilities=p,timestamp=null,status='valid')=>({anchor,order:Number(anchor.replace(/\D/g,''))||1,probabilities,timestamp,status,truncated:false});
test('ten stable IDs and 3+3+4 hierarchy',()=>{assert.equal(C.TYPES.length,10);assert.deepEqual(C.PARENTS.map(p=>p.children.length),[3,3,4]);assert.deepEqual(C.PARENTS.flatMap(p=>p.children),C.IDS);});
test('parent sums and independently dominant parent/leaf',()=>{const a=C.aggregate([row('u1')]);assert.ok(Math.abs(a.parents.positive-.45)<1e-9);assert.equal(a.dominantParent,'positive');assert.equal(a.dominantLeaf,'neg_1');assert.ok(Math.abs(Object.values(a.parents).reduce((a,b)=>a+b)-1)<1e-6);});
test('old six-label model and malformed probabilities are rejected',()=>{assert.throws(()=>C.validateProbabilities({anger:.2,sadness:.2,anxiety:.2,hurt:.1,surprise:.1,joy:.2}));assert.throws(()=>C.validateProbabilities({...p,neutral:.5}));assert.throws(()=>C.validateProbabilities({...p,pos_1:NaN}));assert.throws(()=>C.aggregate([{...row('u1'),truncated:true}]));});
test('empty, invalid and actual neutral differ',()=>{assert.equal(C.aggregate([]).status,'empty');assert.equal(C.aggregate([row('u1',null,null,'invalid')]).status,'unanalyzable');assert.equal(C.demoResult('neutral').summary.dominantLeaf,'neu_1');assert.equal(C.demoResult('neutral').summary.parents.neutral,1);});
test('invalid results are excluded rather than filled with neutral',()=>{const a=C.aggregate([row('u1'),row('u2',null,null,'invalid')]);assert.equal(a.status,'partial');assert.equal(a.validCount,1);assert.deepEqual(a.leaf,p);});
test('nontext exclusion occurs before overall last100, then speaker selection',()=>{const ls=['A 님과 카카오톡 대화','--------------- 2026년 10월 28일 수요일 ---------------'];for(let i=0;i<121;i++)ls.push(`[${i%2?'B':'A'}] [오전 9:00] ${i===120?'사진':'말 '+i}`);const d=C.parsePC(ls.join('\n'));assert.equal(d.allText.length,120);assert.equal(d.recent.length,100);assert.equal(d.recent[0].text,'말 20');assert.equal(d.excluded,1);assert.equal(C.selectTarget(d,'A').length,50);assert.throws(()=>C.selectTarget(d,'missing'));});
test('speaker with no utterances in recent100 cannot be selected',()=>{const ls=['[A] [오전 9:00] 이전 발화'];for(let i=0;i<100;i++)ls.push('[B] [오전 9:00] 최근 발화');const d=C.parsePC(ls.join('\n'));assert.equal(d.speakers.find(s=>s.name==='A').recent,0);assert.throws(()=>C.selectTarget(d,'A'));});
test('PC multiline and PM timestamp normalization',()=>{const d=C.parsePC('--------------- 2026년 10월 28일 수요일 ---------------\n[A] [오후 12:10] 첫 줄\n둘째 줄\n[B] [오전 12:00] 다음');assert.equal(d.recent[0].text,'첫 줄\n둘째 줄');assert.equal(d.recent[0].timestamp,'2026-10-28T12:10:00+09:00');assert.equal(d.recent[1].timestamp,'2026-10-28T00:00:00+09:00');});
test('empty, mobile, binary and unsupported messages fail explicitly',()=>{for(const text of ['', '2026. 10. 28. 오전 9:00, A : 안녕','\u0000','[A] [오전 9:00] 사진'])assert.throws(()=>C.parsePC(text));assert.throws(()=>C.parsePC('[A] [오전 13:00] 오류'));assert.throws(()=>C.parsePC('--------------- 2026년 2월 31일 화요일 ---------------\n[A] [오전 9:00] 날짜 오류'));assert.equal(C.dateKey('2026-02-31T09:00:00+09:00'),null);});
test('window max3, stride1, first anchor; short endings preserved',()=>{const us=[1,2,3,4].map(i=>({id:'u'+i}));assert.deepEqual(C.windows(us).map(w=>[w.anchor,w.utterances.length]),[['u1',3],['u2',3],['u3',2],['u4',1]]);});
test('periods average source rows, not daily means, with missing timestamps excluded',()=>{const neutral={pos_1:0,pos_2:0,pos_3:0,neg_1:0,neg_2:0,neg_3:0,neu_1:1,neu_2:0,neu_3:0,neu_4:0};const rows=[row('u1',p,'2026-10-26T09:00:00+09:00'),row('u2',neutral,'2026-10-27T09:00:00+09:00'),row('u3',neutral,'2026-10-27T10:00:00+09:00'),row('u4')];const g=C.groupPeriods(rows,'week');assert.equal(g.missing,1);assert.equal(g.groups.length,1);assert.equal(g.groups[0].validCount,3);assert.ok(Math.abs(g.groups[0].parents.neutral-(1+1+.15)/3)<1e-9);assert.equal(g.groups[0].key,'2026-10-26');});
test('missing calendar dates are absent, never zero-filled',()=>{const g=C.groupPeriods([row('u1',p,'2026-10-22T00:00:00+09:00'),row('u2',p,'2026-10-24T00:00:00+09:00')]);assert.deepEqual(g.groups.map(g=>g.key),['2026-10-22','2026-10-24']);assert.equal(C.groupPeriods(C.demoResult('no-time').rows).groups.length,0);});
test('repeats count distinct originals and total occurrences independently',()=>{const target=[{id:'u1',text:'진짜 진짜 좋다'},{id:'u2',text:'진짜 좋다'},{id:'u3',text:'다른 말'}];const x=C.repeats(target,target.map(u=>row(u.id))).find(x=>x.label==='진짜');assert.equal(x.utteranceFrequency,2);assert.equal(x.totalCount,3);assert.equal(x.linkedCount,2);assert.equal(Object.values(x.parentCounts).reduce((a,b)=>a+b),2);assert.equal(x.leafCounts.neg_1,2);assert.equal(x.parentCounts.positive,2);});
test('repeat3% threshold uses all original target utterances',()=>{const target=Array.from({length:100},(_,i)=>({id:'u'+i,text:i<2?'진짜':'다름'+i}));assert.ok(!C.repeats(target,[]).some(x=>x.label==='진짜'));});
test('fixture raw source, aggregate and date counts agree',()=>{const d=C.demoResult();assert.equal(d.rows.length,43);assert.equal(d.target.length,43);assert.ok(Math.abs(d.summary.leaf.pos_1-.18)<1e-9);assert.equal(d.summary.dominantParent,'positive');assert.equal(d.summary.dominantLeaf,'pos_1');assert.deepEqual(C.groupPeriods(d.rows).groups.map(g=>g.validCount),[6,6,6,6,6,6,7]);});
test('filter searches ID/name/number and sorts the same probabilities',()=>{const s=C.demoResult().summary;assert.equal(C.filterTypes({parentId:'negative'}).length,3);assert.equal(C.filterTypes({query:'EC-001'})[0].id,'pos_1');assert.equal(C.filterTypes({query:'neg_1'})[0].name,'불안');assert.equal(C.filterTypes({query:'존재하지않음'}).length,0);assert.equal(C.filterTypes({sort:'probability',summary:s})[0].id,'pos_1');});
test('rendered text cannot inject HTML',()=>{assert.equal(C.escapeHTML('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');});
test('narrative contains only fixture facts, no causal advice',()=>{const text=C.narrative(C.demoResult());assert.match(text,/43개/);assert.match(text,/45.0%/);assert.match(text,/기쁨·활력 18.0%/);assert.ok(!/때문|성격|진단|해야/.test(text));});

test('ten leaves have exact names and preserve negative asset IDs', () => {
  assert.deepEqual(C.TYPES.map(t => t.name), ['기쁨·활력','만족·감사','안정·자신감','불안','슬픔','분노','객관적 서술','의문','놀람','당황']);
  assert.equal(new Set(C.IDS).size, 10);
  assert.equal(C.TAXONOMY, 'emotion-cardex-3plus10-v1');
  assert.deepEqual(C.filterTypes({parentId:'neutral'}).map(t => t.id), ['neu_1','neu_2','neu_3','neu_4']);
});
test('legacy seven leaves, missing and extra IDs, range and nonfinite probabilities are rejected', () => {
  const {neu_4, ...missing} = p;
  const legacy = {pos_1:.18,pos_2:.15,pos_3:.12,neg_1:.25,neg_2:.09,neg_3:.06,neutral:.15};
  for (const invalid of [legacy, missing, {...p,extra:0}, {...p,pos_1:-.01}, {...p,pos_1:Infinity}, {...p,pos_1:1.1}]) assert.throws(() => C.validateProbabilities(invalid));
  for (const id of ['neu_1','neu_2','neu_3','neu_4']) {
    const one = Object.fromEntries(C.IDS.map(key => [key, key === id ? 1 : 0]));
    assert.equal(C.parentProbabilities(one).neutral, 1);
  }
});

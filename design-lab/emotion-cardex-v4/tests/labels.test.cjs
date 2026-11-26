const test=require('node:test'),assert=require('node:assert/strict');
const current=require('../scripts/core.js'),previous=require('../../emotion-cardex-v2/scripts/core.js');
test('only pos_3 display label changes to 평온',()=>{
 assert.deepEqual(current.TYPES.map(t=>t.name),['기쁨','만족','평온','불안','슬픔','분노','중립']);
 assert.deepEqual(current.TYPES.map(({name,...t})=>t),previous.TYPES.map(({name,...t})=>t));
 assert.deepEqual(current.PARENTS,previous.PARENTS);assert.equal(current.TAXONOMY,previous.TAXONOMY);
});
test('all structured demo results remain byte-for-byte equivalent',()=>{
 for(const mode of ['normal','neutral','no-time','invalid','empty'])assert.equal(JSON.stringify(current.demoResult(mode)),JSON.stringify(previous.demoResult(mode)),mode);
});
test('search and detail resolve the revised label to the unchanged ID',()=>{
 assert.equal(current.filterTypes({query:'평온'})[0].id,'pos_3');assert.equal(current.filterTypes({query:'안정'}).length,0);assert.equal(current.type('pos_3').number,'003');
});
test('generated factual narrative uses 평온 when pos_3 is dominant',()=>{
 const probabilities={pos_1:.1,pos_2:.1,pos_3:.5,neg_1:.05,neg_2:.05,neg_3:.05,neutral:.15};
 const summary=current.aggregate([{anchor:'u1',order:1,status:'valid',truncated:false,probabilities}]);
 assert.match(current.narrative({summary}),/평온 50.0%/);assert.doesNotMatch(current.narrative({summary}),/안정/);
});

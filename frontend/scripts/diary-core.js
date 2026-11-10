/* Proposed diary contract. No inference, requests, persistence, or telemetry. */
(function(root,factory){const api=factory(typeof module==='object'?require('./core.js'):root.CardexCore);if(typeof module==='object')module.exports=api;else root.DiaryCore=api;})(globalThis,function(C){
'use strict';
const LIMIT=10000,MAX_RECORDS=30,FILE_LIMIT=1024*1024;
function normalize(text){return String(text).replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').trim();}
function validate(records){
 if(!records.length)throw Error('입력 내용이 없습니다. 일기나 게시물을 붙여넣어 주세요.');
 if(records.length>MAX_RECORDS)throw Error('기록은 최대 30개까지 확인할 수 있습니다.');
 let total=0;
 for(const r of records){const t=normalize(r.text);if(!t)throw Error('비어 있는 기록이 있습니다. 내용을 입력하거나 삭제해 주세요.');if(!/[\p{L}\p{N}]/u.test(t))throw Error('분석 가능한 텍스트가 없습니다. 문자나 숫자를 입력해 주세요.');if(/\u0000/.test(t))throw Error('텍스트에 읽을 수 없는 문자가 있습니다.');total+=Array.from(t).length;if(r.date&&!C.dateKey(r.date+'T12:00:00+09:00'))throw Error('기록 날짜를 확인해 주세요.');}
 if(total>LIMIT)throw Error('전체 입력이 10,000자를 초과했습니다. 원문은 유지되며 자동으로 자르지 않습니다.');
 return {records:records.map((r,i)=>({id:'record-'+(i+1),order:i+1,text:normalize(r.text),date:r.date||null})),characters:total,dated:records.filter(r=>r.date).length};
}
function fixture(mode='single'){
 const vectors=[[.18,.15,.12,.17,.14,.09,.06,.03,.03,.03],[.1,.1,.1,.18,.17,.1,.1,.05,.05,.05],[.2,.2,.15,.1,.1,.1,.06,.03,.03,.03],[.3,.15,.1,.15,.1,.05,.06,.03,.03,.03]];
 const count=mode==='single'?1:4;
 const target=Array.from({length:count},(_,i)=>({id:'fixture-record-'+i,order:i+1,speaker:'예시 기록',timestamp:mode==='no-date'||mode==='single'?null:`2026-10-${22+i*2}T12:00:00+09:00`,text:i%2?'오늘도 나의 기록을 남겼다.':'오늘도 기록을 남겼다.'}));
 const rows=target.map((u,i)=>({anchor:u.id,order:u.order,timestamp:u.timestamp,taxonomy_version:C.TAXONOMY,probabilities:Object.fromEntries(C.IDS.map((id,j)=>[id,vectors[i][j]])),status:'valid',truncated:false}));
 return {id:'diary-design-fixture',kind:'diary',taxonomy_version:C.TAXONOMY,demo:true,speaker:'예시 기록',recentCount:count,totalTextCount:count,target,rows,summary:C.aggregate(rows),expressions:C.repeats(target,rows),segments:C.segments(rows)};
}
function requestDraft(records){const v=validate(records);return {schema_version:'diary-input-proposal-v1',input_type:'diary',taxonomy_version:C.TAXONOMY,records:v.records.map(r=>({record_id:r.id,order:r.order,text:r.text,record_date:r.date})),requested_taxonomy_ids:[...C.IDS]};}
return {LIMIT,MAX_RECORDS,FILE_LIMIT,normalize,validate,fixture,requestDraft};
});

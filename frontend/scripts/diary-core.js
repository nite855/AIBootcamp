/* Proposed diary contract. No inference, requests, persistence, or telemetry. */
(function(root,factory){const api=factory(typeof module==='object'?require('./core.js'):root.CardexCore);if(typeof module==='object')module.exports=api;else root.DiaryCore=api;})(globalThis,function(C){
'use strict';
const LIMIT=10000,WARN=9000,MAX_RECORDS=30,FILE_LIMIT=1024*1024;
function normalize(text){return String(text).replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').trim();}
// Code-point count, matching storage validation. Over-limit text is kept, never truncated.
function lengthState(text){const count=Array.from(String(text??'')).length;return {count,limit:LIMIT,level:count>LIMIT?'over':count>=WARN?'warn':'ok'};}
// Record-count guidance before the 30-record limit blocks a new save.
const LIMIT_NOTICE=5;
function recordLimitState(count){const n=Number.isSafeInteger(count)&&count>0?count:0,remaining=Math.max(0,MAX_RECORDS-n);return {count:n,remaining,level:remaining===0?'full':remaining<=LIMIT_NOTICE?'near':'ok'};}
// Writing prompts are shown only; they are never inserted into the text the model analyzes.
const PROMPTS=Object.freeze(['오늘 잠깐이라도 마음이 편했던 순간은 언제였나요?','오늘 가장 오래 머릿속에 남아 있던 장면은 무엇인가요?','오늘 누군가와 나눈 대화 중 기억에 남는 말이 있나요?','오늘 나를 조금 지치게 한 일은 무엇이었나요?','오늘 스스로에게 고마웠던 점이 있나요?','오늘 예상과 달랐던 일이 있었나요?','지금 몸의 느낌은 어떤가요? 피곤함, 가벼움, 긴장 같은 것들이요.','오늘 하루를 한 장면으로 남긴다면 어떤 모습일까요?','오늘 미뤄 둔 마음이나 하지 못한 말이 있나요?','오늘 작게라도 해낸 일은 무엇인가요?','오늘 나를 웃게 한 것은 무엇이었나요?','요즘 자주 떠오르는 걱정이 있다면 적어 볼까요?','오늘 가장 나다웠던 순간은 언제였나요?','오늘 들었던 소리, 본 풍경, 맡은 냄새 중 하나를 떠올려 보세요.','내일의 나에게 전하고 싶은 말이 있나요?','오늘 화가 나거나 속상했던 순간이 있었나요?','오늘 새롭게 알게 된 것이 있나요?','오늘 하루를 세 단어로 표현한다면요?']);
function writingPrompt(date,offset=0){
 const day=/^\d{4}-\d{2}-\d{2}$/.test(String(date))?Date.parse(date+'T00:00:00Z'):NaN;
 const base=Number.isFinite(day)?Math.floor(day/86400000):0, step=Number.isSafeInteger(offset)?offset:0, n=PROMPTS.length;
 return PROMPTS[(((base+step)%n)+n)%n];
}
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
return {LIMIT,WARN,MAX_RECORDS,FILE_LIMIT,normalize,lengthState,recordLimitState,PROMPTS,writingPrompt,validate,fixture,requestDraft};
});

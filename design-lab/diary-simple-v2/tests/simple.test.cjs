
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
function domain(){const ctx=vm.createContext({console});vm.runInContext(scripts[1],ctx);return {C:ctx.CardexCore,D:ctx.DiaryCore};}
const {C,D}=domain();
function crossTab({details=false,origin='http://localhost',blocked=false}={}){
  const listeners=new Map(),messages=[],timers=[],renders=[];
  const child={closed:false,postMessage:(data,target)=>messages.push({data,target})};
  const source={postMessage:(data,target)=>messages.push({data,target})};
  const app={querySelector:()=>({innerHTML:''})};
  const win={opener:details?source:null,open:()=>blocked?null:child,
    addEventListener:(name,fn)=>listeners.set(name,fn),
    removeEventListener:(name,fn)=>{if(listeners.get(name)===fn)listeners.delete(name);},
    CardexTheme:{getPreference:()=> 'dark',set:v=>{win.theme=v;}}};
  const base=origin==='null'?'file:///C:/moment-card/index.html':'http://localhost/index.html';
  const ctx=vm.createContext({C,state:{result:D.fixture('multi')},window:win,location:{href:base,search:details?'?details=token':'',origin},
    URL,URLSearchParams,crypto:{randomUUID:()=> 'token'},structuredClone,console,app,
    setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout:()=>{},
    render:()=>renders.push('render'),history:{replaceState(){}},
    E:C.escapeHTML,notice:(s)=>s,heading:(s)=>s,
    summary:()=>D.fixture('multi').summary,guards:()=>null,isDiary:()=>true,
    card:()=>'<div class="emotion-card"></div>',
    button:(id,label)=>'<button data-action="'+id+'">'+label+'</button>',
    link:()=>'<a>기록으로 돌아가기</a>',examples:()=>''});
  vm.runInContext(scripts[2].slice(scripts[2].indexOf('  // Simple edition:'),scripts[2].indexOf("  window.addEventListener('hashchange'")),ctx);
  return {ctx,listeners,messages,timers,renders,child,source,win};
}
test('inline JavaScript parses without external runtime dependencies',()=>{for(const [i,s]of scripts.entries())new vm.Script(s,{filename:'inline-'+i});assert.equal(scripts.length,3);assert.ok(!/<script[^>]+src=/.test(html));});
test('date selector is above every record title; delete remains below textarea',()=>{const start=html.indexOf('function diaryInput()'),end=html.indexOf('function diaryConfirm()',start),s=html.slice(start,end);assert.ok(s.indexOf('simple-record-date')<s.indexOf('<legend>'));assert.ok(s.indexOf('data-record-date')<s.indexOf('<textarea'));assert.ok(s.indexOf("button('delete-record'")>s.indexOf('</textarea>'));});
test('main result card comes first and has no chart/table/details data',()=>{const {ctx}=crossTab();const s=vm.runInContext('simpleOverview()',ctx);assert.ok(s.indexOf('emotion-card')<s.indexOf('<h1'));assert.ok(s.includes('open-details'));assert.ok(s.includes('open-share'));assert.ok(!s.includes('<svg'));assert.ok(!s.includes('<table'));assert.ok(s.includes('예시 데이터'));});
test('blocked tab gives recovery message and preserves result',()=>{const a=crossTab({blocked:true});const before=a.ctx.state.result;vm.runInContext('openDetails()',a.ctx);assert.equal(a.ctx.state.result,before);assert.match(vm.runInContext('detailError',a.ctx),/팝업/);assert.equal(a.renders.length,1);});
test('handoff accepts only the exact child, origin and nonce',()=>{const a=crossTab();vm.runInContext('openDetails()',a.ctx);const cb=a.listeners.get('message');const msg={type:'moment-detail-ready',nonce:'token'};cb({source:{},origin:'http://localhost',data:msg});cb({source:a.child,origin:'https://other.example',data:msg});cb({source:a.child,origin:'http://localhost',data:{...msg,nonce:'wrong'}});assert.equal(a.messages.length,0);cb({source:a.child,origin:'http://localhost',data:msg});assert.equal(a.messages.length,1);assert.equal(a.messages[0].target,'http://localhost');assert.equal(a.messages[0].data.result.summary.validCount,4);assert.equal(a.listeners.has('message'),false);});
test('file URL transfer uses wildcard target only with exact child/source checks',()=>{const a=crossTab({origin:'null'});vm.runInContext('openDetails()',a.ctx);a.listeners.get('message')({source:a.child,origin:'null',data:{type:'moment-detail-ready',nonce:'token'}});assert.equal(a.messages[0].target,'*');});
test('child restores identical result in memory and detaches opener',()=>{const a=crossTab({details:true});assert.equal(a.messages[0].data.type,'moment-detail-ready');const result=D.fixture('no-date');a.listeners.get('message')({source:a.source,origin:'http://localhost',data:{type:'moment-detail-data',nonce:'token',result,theme:'dark'}});assert.equal(a.ctx.state.result,result);assert.equal(a.ctx.state.route,'overview');assert.equal(a.win.opener,null);assert.equal(a.win.theme,'dark');assert.equal(a.renders.length,1);});
test('child rejects mismatched summary instead of displaying distorted values',()=>{const a=crossTab({details:true});const r=D.fixture('multi');r.summary.leaf.pos_1+=.1;r.summary.leaf.neutral-=.1;a.listeners.get('message')({source:a.source,origin:'http://localhost',data:{type:'moment-detail-data',nonce:'token',result:r}});assert.equal(a.renders.length,0);assert.equal(a.win.opener,null);});
test('handoff timeout gives a recovery notice without deleting original result',()=>{const a=crossTab();vm.runInContext('openDetails()',a.ctx);a.timers[0]();assert.match(vm.runInContext('detailError',a.ctx),/다시 열어/);assert.equal(a.ctx.state.result.summary.validCount,4);});

test('single/no-date fixtures keep unavailable states separate',()=>{assert.equal(D.fixture('single').rows.length,1);assert.ok(D.fixture('no-date').rows.every(r=>r.timestamp===null));assert.equal(C.groupPeriods(D.fixture('no-date').rows).missing,4);});
test('distribution parent totals derive from seven original probabilities',()=>{const a=D.fixture('multi').summary;assert.ok(Math.abs(a.parents.positive-.4625)<1e-9);assert.ok(Math.abs(a.parents.negative-.3625)<1e-9);assert.ok(Math.abs(a.parents.neutral-.175)<1e-9);});
test('input validation rejects empty, oversized and invalid dates without truncation',()=>{assert.throws(()=>D.validate([{text:''}]));assert.throws(()=>D.validate([{text:'가'.repeat(10001)}]));assert.throws(()=>D.validate([{text:'가',date:'2026-02-30'}]));assert.equal(D.validate([{text:'가'.repeat(10000)}]).characters,10000);});
for (const newline of ['\n','\r\n']) test(`delete action preserves records with ${newline === '\n' ? 'LF' : 'CRLF'} source`,()=>{
 const source=scripts[2].replace(/\r?\n/g,newline);
 const deletion={dataset:{index:'1'}},count={textContent:''};
 const context=vm.createContext({window:{DiaryCore:D},C,state:{result:{}},app:{querySelectorAll:s=>s==='[data-action="delete-record"]'?[deletion]:[],querySelector:()=>null},document:{getElementById:id=>id==='input-count'?count:{focus(){}},querySelector:()=>null},render(){},clearShare(){},console});
 const start=source.indexOf('  const D=window.DiaryCore;');
 assert.ok(start>=0,'diary block must exist');
 const diaryBlock=source.slice(start,source.indexOf('  // Simple edition:',start)).replace(/\r\n/g,'\n');
 const bindStart=diaryBlock.indexOf('  function bindDiary()');
 const closing=diaryBlock.indexOf('\n  }\n',bindStart);
 assert.ok(bindStart>=0 && closing>bindStart,'bindDiary boundaries must exist');
 const bindEnd=closing+5;
 vm.runInContext(diaryBlock.slice(0,bindEnd),context);
 vm.runInContext("diary.records=[{text:'첫 글',date:'2026-10-22'},{text:'삭제할 글',date:'2026-10-23'},{text:'마지막 글',date:''}];bindDiary();",context);
 deletion.onclick();
 assert.equal(vm.runInContext('diary.records.length',context),2);
 assert.equal(vm.runInContext('diary.records[1].text',context),'마지막 글');
 assert.equal(vm.runInContext('diary.records[0].date',context),'2026-10-22');
 deletion.dataset.index='0';deletion.onclick();deletion.onclick();
 assert.equal(vm.runInContext('diary.records.length',context),1);
 assert.equal(vm.runInContext('diary.records[0].text',context),'');
 assert.equal(vm.runInContext('diary.records[0].date',context),'');
});




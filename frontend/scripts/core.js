/* Emotion Cardex domain functions. No network, DOM, storage, or model inference. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CardexCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const TAXONOMY = 'emotion-cardex-3plus10-v1';
  const PARENTS = Object.freeze([
    {id:'positive',name:'긍정',mark:'+',color:'#278E81',children:['pos_1','pos_2','pos_3']},
    {id:'negative',name:'부정',mark:'−',color:'#D25B35',children:['neg_1','neg_2','neg_3']},
    {id:'neutral',name:'중립',mark:'=',color:'#78899B',children:['neu_1','neu_2','neu_3','neu_4']}
  ]);
  const TYPES = Object.freeze([
    {id:'pos_1',number:'001',name:'기쁨·활력',parent:'positive',color:'#278E81',pattern:'circle'},
    {id:'pos_2',number:'002',name:'만족·감사',parent:'positive',color:'#527842',pattern:'grid'},
    {id:'pos_3',number:'003',name:'안정·자신감',parent:'positive',color:'#417D9B',pattern:'horizontal'},
    {id:'neg_1',number:'004',name:'불안',parent:'negative',color:'#8068B3',pattern:'diagonal'},
    {id:'neg_2',number:'005',name:'슬픔',parent:'negative',color:'#417DA7',pattern:'vertical'},
    {id:'neg_3',number:'006',name:'분노',parent:'negative',color:'#C34B52',pattern:'cross'},
    {id:'neu_1',number:'007',name:'객관적 서술',parent:'neutral',color:'#78899B',pattern:'document',asset:'neutral'},
    {id:'neu_2',number:'008',name:'의문',parent:'neutral',color:'#78899B',pattern:'question',asset:'neutral'},
    {id:'neu_3',number:'009',name:'놀람',parent:'neutral',color:'#78899B',pattern:'exclamation',asset:'neutral'},
    {id:'neu_4',number:'010',name:'당황',parent:'neutral',color:'#78899B',pattern:'mixed',asset:'neutral'}
  ]);
  const IDS = TYPES.map(t=>t.id);
  const type = id=>TYPES.find(t=>t.id===id);
  const parent = id=>PARENTS.find(p=>p.id===id);
  const sum = xs=>xs.reduce((a,b)=>a+b,0);
  const zeros = ()=>Object.fromEntries(IDS.map(id=>[id,0]));
  const percent = n=>Number.isFinite(n)?(n*100).toFixed(1)+'%':'—';
  const escapeHTML = s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function validateProbabilities(p) {
    if (!p || Object.keys(p).length!==IDS.length || !IDS.every(id=>Object.hasOwn(p,id))) throw new Error('10소분류 ID 계약과 일치하지 않습니다.');
    if (!IDS.every(id=>Number.isFinite(p[id])&&p[id]>=0&&p[id]<=1)) throw new Error('확률은 0~1의 유한한 숫자여야 합니다.');
    if (Math.abs(sum(IDS.map(id=>p[id]))-1)>1e-6) throw new Error('전체 확률 합계가 1이 아닙니다.');
    return p;
  }
  function validateAnalysis(analysis) {
    if (!analysis || analysis.taxonomy_version !== TAXONOMY) throw new Error('감정 분류 버전이 일치하지 않습니다.');
    if (analysis.truncated) throw new Error('잘린 분석 결과는 사용할 수 없습니다.');
    return validateProbabilities(analysis.probabilities);
  }
  function parentProbabilities(p) {
    validateProbabilities(p);
    return Object.fromEntries(PARENTS.map(g=>[g.id,sum(g.children.map(id=>p[id]))]));
  }
  function maxIds(p,ids) {
    const max=Math.max(...ids.map(id=>p[id]));
    return ids.filter(id=>Math.abs(p[id]-max)<1e-9);
  }
  function aggregate(rows) {
    const valid=rows.filter(r=>r.status==='valid');
    for(const row of valid) {
      if(row.truncated)throw new Error('잘린 분석 결과는 사용할 수 없습니다.');
      validateProbabilities(row.probabilities);
    }
    if(!valid.length)return {status:rows.length?'unanalyzable':'empty',validCount:0,totalCount:rows.length,leaf:null,parents:null};
    const leaf=zeros();
    for(const row of valid)for(const id of IDS)leaf[id]+=row.probabilities[id];
    for(const id of IDS)leaf[id]/=valid.length;
    const parents=parentProbabilities(leaf);
    const leafTies=maxIds(leaf,IDS),parentTies=maxIds(parents,PARENTS.map(p=>p.id));
    return {status:valid.length<rows.length?'partial':'success',validCount:valid.length,totalCount:rows.length,leaf,parents,dominantLeaf:leafTies[0],dominantParent:parentTies[0],leafTies,parentTies};
  }
  function isNonText(s) {
    return /^(?:사진(?:\s*\d+장)?|동영상|이모티콘|음성메시지|삭제된 메시지입니다\.?|메시지가 삭제되었습니다\.?|파일:\s*.+|연락처:\s*.+|지도:\s*.+)$/.test(s.trim());
  }
  function parsePC(text) {
    if(!text.trim())throw new Error('비어 있는 파일입니다. 다른 TXT를 선택해 주세요.');
    if(/\u0000/.test(text))throw new Error('텍스트 파일을 확인해 주세요.');
    const lines=text.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').split('\n');
    let date=null,current=null,recognized=0;
    const messages=[];
    for(const line of lines) {
      const day=line.match(/^-+\s*(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
      if(day){date=`${day[1]}-${day[2].padStart(2,'0')}-${day[3].padStart(2,'0')}`;if(!dateKey(date+'T00:00:00+09:00'))throw new Error('날짜 형식을 읽을 수 없습니다. PC 내보내기 파일을 확인해 주세요.');current=null;continue;}
      const m=line.match(/^\[([^\]]+)\]\s+\[(오전|오후)\s+(\d{1,2}):(\d{2})\]\s?(.*)$/);
      if(m) {
        recognized++;
        const hour=Number(m[3]); const minute=Number(m[4]);
        if(hour<1||hour>12||minute>59)throw new Error('시간 형식을 읽을 수 없습니다. PC 내보내기 파일을 확인해 주세요.');
        const h=hour%12+(m[2]==='오후'?12:0);
        current={id:`u${recognized}`,order:recognized,speaker:m[1],timestamp:date?`${date}T${String(h).padStart(2,'0')}:${m[4]}:00+09:00`:null,text:m[5]};
        messages.push(current);
      } else if(current && line && !/^-{5,}|^저장한 날짜|^.+님이 (들어왔|나갔|초대)/.test(line)) current.text+='\n'+line;
    }
    if(!recognized)throw new Error('카카오톡 PC 대화 내보내기 형식이 아닙니다. 모바일 내보내기는 지원하지 않습니다.');
    const allText=messages.filter(m=>m.text.trim()&&!isNonText(m.text));
    if(!allText.length)throw new Error('분석 가능한 텍스트가 없습니다. 사진·이모티콘 등은 제외됩니다.');
    const recent=allText.slice(-100);
    const speakers=[...new Set(allText.map(m=>m.speaker))].map(name=>({name,total:allText.filter(m=>m.speaker===name).length,recent:recent.filter(m=>m.speaker===name).length}));
    return {allText,recent,speakers,totalMessages:messages.length,excluded:messages.length-allText.length};
  }
  function selectTarget(parsed,speaker) {
    if(!parsed.speakers.some(s=>s.name===speaker))throw new Error('화자를 직접 선택해 주세요.');
    const target=parsed.recent.filter(u=>u.speaker===speaker);
    if(!target.length)throw new Error('최근 100개 텍스트 범위에 선택 화자의 발화가 없습니다.');
    return target;
  }
  function windows(target) {
    return target.map((u,i)=>({anchor:u.id,utterances:target.slice(i,i+3),stride:1}));
  }
  function dateKey(timestamp) {
    if(typeof timestamp!=='string'||!/^\d{4}-\d\d-\d\dT/.test(timestamp)||!Number.isFinite(Date.parse(timestamp)))return null;
    // API contract: timestamp is normalized to conversation-local time (+09:00 for demo).
    const day=timestamp.slice(0,10);return new Date(day+'T12:00:00Z').toISOString().slice(0,10)===day?day:null;
  }
  function bucketKey(timestamp,unit) {
    const d=dateKey(timestamp);if(!d)return null;
    if(unit==='month')return d.slice(0,7);
    if(unit==='week') {
      const dt=new Date(d+'T12:00:00Z');const delta=(dt.getUTCDay()+6)%7;
      dt.setUTCDate(dt.getUTCDate()-delta);return dt.toISOString().slice(0,10);
    }
    return d;
  }
  function groupPeriods(rows,unit='day') {
    const groups=new Map();let missing=0;
    for(const r of rows.filter(r=>r.status==='valid')) {
      const key=bucketKey(r.timestamp,unit);if(!key){missing++;continue;}
      if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);
    }
    return {missing,groups:[...groups.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([key,items])=>({key,rows:items,...aggregate(items)}))};
  }
  function repeats(target,rows) {
    const candidates=new Map();
    target.forEach(u=>{
      const tokens=u.text.match(/[\p{L}\p{N}ㅋㅎㅠㅜ]+/gu)||[];
      for(let n=1;n<=3;n++)for(let i=0;i<=tokens.length-n;i++){
        const label=tokens.slice(i,i+n).join(' ');if(label.length<2)continue;
        if(!candidates.has(label))candidates.set(label,{label,ids:new Set(),totalCount:0});
        const item=candidates.get(label);item.ids.add(u.id);item.totalCount++;
      }
    });
    const threshold=Math.max(2,Math.ceil(target.length*.03));
    return [...candidates.values()].filter(x=>x.ids.size>=threshold).map(x=>{
      const linked=rows.filter(r=>x.ids.has(r.anchor)&&r.status==='valid');
      const a=aggregate(linked);const parents=Object.fromEntries(PARENTS.map(p=>[p.id,0]));const leaves=zeros();
      for(const r of linked){parents[maxIds(parentProbabilities(r.probabilities),PARENTS.map(p=>p.id))[0]]++;leaves[maxIds(r.probabilities,IDS)[0]]++;}
      return {label:x.label,utteranceFrequency:x.ids.size,totalCount:x.totalCount,denominator:target.length,threshold,linkedCount:linked.length,missingCount:x.ids.size-linked.length,ids:[...x.ids],parentCounts:parents,leafCounts:leaves,average:a.leaf};
    }).sort((a,b)=>b.utteranceFrequency-a.utteranceFrequency||b.totalCount-a.totalCount||a.label.localeCompare(b.label,'ko'));
  }
  function segments(rows) {
    const out=[];
    for(const g of PARENTS)for(const direction of [1,-1]) {
      let start=0;
      const emit=end=>{
        if(end-start<2)return;
        const a=parentProbabilities(rows[start].probabilities)[g.id],b=parentProbabilities(rows[end].probabilities)[g.id];
        if(direction*(b-a)>=.15)out.push({id:g.id,from:rows[start].order,to:rows[end].order,delta:b-a,start:rows[start].anchor,end:rows[end].anchor});
      };
      for(let i=0;i<rows.length;i++){
        if(rows[i].status!=='valid'){if(i>start)emit(i-1);start=i+1;continue;}
        if(i>start){const prev=rows[i-1];if(prev.status!=='valid'){start=i;continue;}const diff=parentProbabilities(rows[i].probabilities)[g.id]-parentProbabilities(prev.probabilities)[g.id];if(direction*diff<-.02){emit(i-1);start=i;}}
      }
      if(start<rows.length)emit(rows.length-1);
    }
    return out.sort((a,b)=>a.from-b.from);
  }
  function demoResult(mode='normal') {
    const target=[],rows=[];
    const dates=[];for(let d=22;d<=28;d++)for(let j=0;j<(d===28?7:6);j++)dates.push(`2026-10-${d}`);
    for(let i=0;i<43;i++){
      let probs={pos_1:.18,pos_2:.15,pos_3:.12,neg_1:.17,neg_2:.14,neg_3:.09,neu_1:.06,neu_2:.03,neu_3:.03,neu_4:.03};
      if(mode==='neutral')probs={pos_1:0,pos_2:0,pos_3:0,neg_1:0,neg_2:0,neg_3:0,neu_1:1,neu_2:0,neu_3:0,neu_4:0};
      const stamp=mode==='no-time'?null:`${dates[i]}T${String(9+i%9).padStart(2,'0')}:00:00+09:00`;
      const text=i%5===0?'진짜 진짜 오늘도 같이 해보자':i%3===0?'같이 해보자 다음에 이야기하자':'오늘 일정 확인했어';
      const u={id:`demo-${i+1}`,speaker:'민서',order:i+1,timestamp:stamp,text};target.push(u);
      rows.push({anchor:u.id,order:i+1,timestamp:stamp,taxonomy_version:TAXONOMY,probabilities:probs,status:mode==='invalid'?'invalid':'valid',truncated:false});
    }
    if(mode==='empty'){target.length=0;rows.length=0;}
    return {id:'demo-cardex-001',taxonomy_version:TAXONOMY,demo:true,speaker:'민서',recentCount:100,totalTextCount:142,target,rows,summary:aggregate(rows),expressions:repeats(target,rows),segments:segments(rows)};
  }
  function filterTypes({parentId='all',query='',sort='number',summary=null}={}) {
    const q=query.toLowerCase().trim();
    const list=TYPES.filter(t=>(parentId==='all'||t.parent===parentId)&&(!q||`${t.name} ${t.id} EC-${t.number}`.toLowerCase().includes(q)));
    if(sort==='probability'&&summary?.leaf)list.sort((a,b)=>summary.leaf[b.id]-summary.leaf[a.id]||a.number.localeCompare(b.number));
    else if(sort==='name')list.sort((a,b)=>a.name.localeCompare(b.name,'ko'));
    return list;
  }
  function narrative(result) {
    const s=result.summary;if(!s.leaf)return '유효한 감정 분석 결과가 없어 분포를 표시할 수 없습니다.';
    return `유효한 대상 화자 발화 ${s.validCount}개 기준, 대분류는 ${PARENTS.map(p=>`${p.name} ${percent(s.parents[p.id])}`).join(', ')}입니다. 대표 대분류는 ${parent(s.dominantParent).name}, 최다 소분류는 ${type(s.dominantLeaf).name} ${percent(s.leaf[s.dominantLeaf])}입니다. 두 대표값은 각각 계산했습니다.`;
  }
  return {TAXONOMY,PARENTS,TYPES,IDS,type,parent,percent,escapeHTML,validateProbabilities,validateAnalysis,parentProbabilities,aggregate,parsePC,selectTarget,windows,dateKey,bucketKey,groupPeriods,repeats,segments,demoResult,filterTypes,narrative};
});

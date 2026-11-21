/* View/controller layer. Local parsing + explicit synthetic demo; no production API calls. */
(function () {
  'use strict';
  const C=window.CardexCore,E=C.escapeHTML;
  const routes={start:'시작',upload:'파일 업로드',speaker:'화자 선택',progress:'분석 진행',overview:'결과 Overview',cardex:'감정 도감',gallery:'카드 갤러리',detail:'카드 상세',distribution:'감정 분포',flow:'감정 흐름',period:'기간별 분석',calendar:'감정 캘린더',repeats:'반복 표현',summary:'종합 결과',states:'상태와 복구'};
  const icons={start:'↗',overview:'▦',cardex:'▤',gallery:'▧',distribution:'▥',flow:'⌁',period:'◷',calendar:'▦',repeats:'≋',summary:'≡',states:'ⓘ'};
  const state={route:'start',parentId:null,query:'',sort:'number',variant:'base',leaf:'neg_1',flowView:'all',hiddenSeries:new Set(),periodUnit:'day',month:'2026-10',date:'2026-10-28',parsed:null,speaker:null,fileName:null,error:null,result:null,narrative:'success',image:'unmapped',demoMode:'normal',returnRoute:'cardex',returnFocus:null,scrolls:{},progress:'idle'};
  const app=document.getElementById('app');
  let focusReturn=null;
  function href(route,leaf){return '#'+route+(leaf?'?id='+encodeURIComponent(leaf):'');}
  function link(route,label,cls='btn secondary',leaf){return `<a class="${cls}" href="${href(route,leaf)}" data-route="${route}">${label}</a>`;}
  function button(action,label,cls='btn secondary',attrs=''){return `<button type="button" class="${cls}" data-action="${action}" ${attrs}>${label}</button>`;}
  function badge(text,cls=''){return `<span class="badge ${cls}">${text}</span>`;}
  function notice(text,kind='',title=''){return `<div class="notice ${kind}" ${kind==='error'?'role="alert"':''}><span class="notice-mark" aria-hidden="true">${kind==='error'?'!':'i'}</span><div>${title?`<strong>${title}</strong>`:''}<p>${text}</p></div></div>`;}
  function heading(title,desc,index){return `<div class="page-heading"><div><div class="eyebrow">MOMENT CARD / EMOTION CARDEX</div><h1 tabindex="-1">${title}</h1><p>${desc}</p></div><span class="page-index">${index||'CARDEX / V.01'}</span></div>`;}
  function panel(title,content,action='',subtitle=''){return `<section class="panel"><div class="panel-title"><div><h2>${title}</h2>${subtitle?`<p class="panel-subtitle">${subtitle}</p>`:''}</div>${action}</div>${content}</section>`;}
  function empty(title,desc,action=''){return `<div class="empty"><div class="empty-icon" aria-hidden="true">◇</div><h2>${title}</h2><p>${desc}</p>${action}</div>`;}
  function summary(){return state.result?.summary;}
  function probability(id){return summary()?.leaf?.[id];}
  function resultNotice(){return notice('예시 데이터로 탐색 중입니다. 실제 대화 분석 결과가 아닙니다. 표시명과 캐릭터 매핑은 미확정입니다.','warning');}
  function guards(){
    if(!state.result)return empty('분석 결과를 먼저 준비해 주세요','대화 파일을 선택하거나 별도의 예시 데이터로 화면을 체험할 수 있습니다.',`<div class="toolbar">${link('upload','파일 선택')}${button('demo','예시 데이터 체험','btn')}</div>`);
    if(!summary().leaf)return empty(summary().status==='empty'?'결과 없음':'분석 불가',summary().status==='empty'?'선택된 분석 대상 발화가 없습니다.':'유효한 7소분류 결과가 없습니다. 중립으로 대체하지 않습니다.',`<div class="toolbar">${link('upload','다른 파일 선택')}${button('demo','일반 예시로 복구','btn')}</div>`);
    return null;
  }
  function card(t,compact=false,staticCard=false){
    const p=probability(t.id),parent=C.parent(t.parent);const cls=`emotion-card ${compact?'compact ':''}${state.variant}`;
    const tag=staticCard?'div':'a';
    return `<${tag} class="${cls}" style="--emotion:${t.color}" ${staticCard?'':`href="${href('detail',t.id)}" data-card-id="${t.id}" aria-label="EC-${t.number} ${t.name} 상세, 전체 기준 ${C.percent(p)}"`}>
      <div class="card-top"><span>EC-${t.number}</span><span class="card-parent">${parent.mark} ${parent.name}</span></div>
      <div class="art-slot" data-asset-slot="${t.id}"><span class="slot-corner tl"></span><span class="slot-label">CHARACTER<br>자산 승인 대기</span><span class="slot-corner br"></span></div>
      <div class="emotion-indicator"></div><div class="card-bottom"><div><div class="card-name">${t.name}</div><div class="card-id">${t.id}</div></div><div class="card-prob">${p===undefined?'—':(p*100).toFixed(1)}${p===undefined?'':'<small>%</small>'}</div></div>
      <div class="card-caption">${state.route==='start'?'유형 식별 번호 · UI 시연용':'전체 기준 평균 확률'}</div>
    </${tag}>`;
  }
  function parentSelector(){
    const s=summary();return `<div class="stack sm"><div class="step-label"><span class="step-pill">1</span><strong>대분류를 선택하세요</strong><span>3대분류</span></div><div class="parent-grid">${C.PARENTS.map(p=>`<button class="parent-button ${state.parentId===p.id?'selected':''}" type="button" data-parent="${p.id}" aria-pressed="${state.parentId===p.id}" style="--emotion:${p.color}"><span class="parent-name"><span class="parent-mark">${p.mark}</span>${p.name}</span><span class="parent-prob">${C.percent(s?.parents?.[p.id])}</span><span class="parent-meta">소분류 ${p.children.length}개 · 전체 기준</span></button>`).join('')}</div></div>`;
  }
  function stacked(s=summary()){
    if(!s?.parents)return '';
    return `<div class="stacked-bar" role="img" aria-label="${C.PARENTS.map(p=>p.name+' '+C.percent(s.parents[p.id])).join(', ')}">${C.PARENTS.map(p=>`<div class="stacked-segment" style="width:${s.parents[p.id]*100}%;background:${p.color}"></div>`).join('')}</div><div class="legend">${C.PARENTS.map(p=>`<span class="legend-item"><span class="swatch" style="--emotion:${p.color}"></span>${p.mark} ${p.name} <strong>${C.percent(s.parents[p.id])}</strong></span>`).join('')}</div>`;
  }
  function bars(s=summary(),parentId=state.parentId){
    if(!s?.leaf)return '';
    const parents=parentId&&parentId!=='all'?[C.parent(parentId)]:C.PARENTS;
    return parents.map(p=>`<div class="bars-group"><div class="bars-group-title"><span>${p.mark} ${p.name} · ${p.children.length}소분류</span><span>${C.percent(s.parents[p.id])}</span></div>${p.children.map(id=>{const t=C.type(id);return `<div class="bar-row"><a class="bar-label" href="${href('detail',id)}" data-card-id="${id}">${t.name}</a><div class="bar-track"><div class="bar-fill" style="width:${s.leaf[id]*100}%;--emotion:${t.color}"></div></div><span class="bar-value">${C.percent(s.leaf[id])}</span></div>`;}).join('')}</div>`).join('');
  }
  function exactTable(rows,kind='flow'){
    const headers=kind==='flow'?['발화','시간','긍정','부정','중립']:['구간','표본','긍정','부정','중립'];
    return `<details class="table-reveal"><summary>정확한 값 표 보기 · ${rows.length}개 ${kind==='flow'?'발화':'구간'}</summary><div class="table-wrap"><table class="data-table"><caption class="sr-only">전체 기준 확률, 0~100퍼센트</caption><thead><tr>${headers.map(h=>`<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>{
      const s=kind==='flow'?(r.status==='valid'?C.parentProbabilities(r.probabilities):null):r.parents;
      return `<tr><th scope="row">${E(kind==='flow'?r.order:r.key)}</th><td>${E(kind==='flow'?(r.timestamp?r.timestamp.slice(5,16).replace('T',' '):'시간 없음'):r.validCount+'개')}</td>${C.PARENTS.map(p=>`<td class="number">${s?C.percent(s[p.id]):'분석 불가'}</td>`).join('')}</tr>`;
    }).join('')}</tbody></table></div></details>`;
  }
  function seriesFor(view){
    if(view==='all')return C.PARENTS.map(p=>({id:p.id,name:p.name,color:p.color,parent:true}));
    if(view==='seven')return C.TYPES;
    return C.TYPES.filter(t=>t.parent===view);
  }
  function chart(rows,opts={}){
    const view=opts.leaf?'leaf':(opts.view||state.flowView);let series=opts.leaf?[C.type(opts.leaf)]:seriesFor(view);
    const W=window.innerWidth<768?Math.max(240,window.innerWidth-76):600,H=210,L=36,R=16,T=14,B=30,pw=W-L-R,ph=H-T-B;
    const val=(row,s)=>row.status==='valid'?(s.parent?C.parentProbabilities(row.probabilities)[s.id]:row.probabilities[s.id]):null;
    const firstTime=rows[0]?.timeMs,lastTime=rows[rows.length-1]?.timeMs;const x=i=>L+(rows.length<=1?pw/2:opts.period&&lastTime>firstTime?(rows[i].timeMs-firstTime)/(lastTime-firstTime)*pw:i/(rows.length-1)*pw),y=v=>T+(1-v)*ph;
    let svg=`<svg class="line-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="감정 확률 추이, 세로축 0에서100퍼센트, 가로축 ${opts.period?'선택한 기간':'대상 화자 발화 순서'}"><title>전체 기준 감정 확률. 정확한 값은 아래 표에서 확인하세요.</title>`;
    for(const tick of [0,.25,.5,.75,1])svg+=`<line x1="${L}" y1="${y(tick)}" x2="${W-R}" y2="${y(tick)}" stroke="#d7dce3" stroke-width="1"/><text x="${L-8}" y="${y(tick)+4}" text-anchor="end" font-size="12" fill="#59677b">${tick*100}</text>`;
    series.forEach((s,idx)=>{
      if(!opts.leaf&&state.hiddenSeries.has(s.id))return;
      let path='',active=false;
      rows.forEach((r,i)=>{const v=val(r,s);if(v===null){active=false;return;}path+=(active?' L':' M')+x(i).toFixed(2)+' '+y(v).toFixed(2);active=true;});
      svg+=`<path d="${path}" fill="none" stroke="${s.color}" stroke-width="2.4" ${idx%3===1?'stroke-dasharray="6 3"':idx%3===2?'stroke-dasharray="2 3"':''}/>`;
      rows.forEach((r,i)=>{const v=val(r,s);if(v!==null)svg+=`<circle cx="${x(i)}" cy="${y(v)}" r="2.3" fill="${s.color}"/>`;});
    });
    const axisIndices=[...new Set([0,Math.floor((rows.length-1)/2),rows.length-1])].filter(i=>i>=0);
    axisIndices.forEach(i=>svg+=`<text x="${x(i)}" y="${H-6}" text-anchor="middle" font-size="12" fill="#59677b">${opts.period?String(rows[i].order).slice(5):rows[i].order}</text>`);
    rows.forEach((r,i)=>{
      const label=r.status!=='valid'?`${r.order} · 데이터 없음`:`${opts.period?'기간':'발화'} ${r.order}, ${opts.period?'표본 '+r.count+'개':r.timestamp?r.timestamp.slice(5,16).replace('T',' '):'시간 없음'} · ${series.map(s=>s.name+' '+C.percent(val(r,s))).join(', ')} · 전체 기준`;
      svg+=`<rect class="chart-point" x="${x(i)-Math.max(4,pw/Math.max(1,rows.length)/2)}" y="${T}" width="${Math.max(8,pw/Math.max(1,rows.length))}" height="${ph}" tabindex="0" role="button" aria-label="${E(label)}" data-tooltip="${E(label)}"><title>${E(label)}</title></rect>`;
    });
    svg+='</svg>';
    return `<div class="chart-wrap">${svg}<div class="chart-caption">Y축 전체 기준 0–100% · X축 ${opts.period?'기간 · 빈 구간은 연결하지 않음':'대상 화자 발화 순서 · 유효 표본 '+rows.filter(r=>r.status==='valid').length+'개'}</div><div class="tooltip" aria-live="polite">점에 마우스를 올리거나 키보드로 선택하면 값과 시간이 표시됩니다.</div></div>`;
  }
  function flowControls(){return `<div class="filter-chips" role="group" aria-label="감정 흐름 보기">${[['all','3대분류'],['positive','긍정'],['negative','부정'],['neutral','중립'],['seven','7개 비교']].map(([id,name])=>`<button class="chip ${state.flowView===id?'active':''}" data-view="${id}" aria-pressed="${state.flowView===id}" type="button">${name}</button>`).join('')}</div><div class="chart-series">${seriesFor(state.flowView).map(s=>`<label class="series-control"><input type="checkbox" data-series="${s.id}" ${state.hiddenSeries.has(s.id)?'':'checked'}><span class="swatch" style="--emotion:${s.color}"></span>${s.name}</label>`).join('')}</div>`;}
  function expressionRows(limit=3){
    const items=state.result.expressions.slice(0,limit);
    if(!items.length)return '<p class="muted small">조건을 충족하는 반복 표현이 없습니다.</p>';
    return items.map(x=>`<div class="expression"><div class="stack sm"><span class="expression-label">“${E(x.label)}”</span><span class="muted small">서로 다른 원본 발화 ${x.utteranceFrequency}/${x.denominator}개</span></div><div class="expression-count"><strong>${x.totalCount}회</strong><div class="small muted">총 출현</div></div></div>`).join('');
  }
  function start(){return `<div class="landing"><div class="landing-hero"><div class="landing-copy"><div class="eyebrow">DISCOVER YOUR CONVERSATION</div><h1 class="landing-title" tabindex="-1">대화의 감정을<br><em>한 장씩</em> 발견하다.</h1><p>흘러간 대화를 감정 도감으로 펼쳐 보세요.<br>3대분류에서 7소분류까지, 숫자와 카드로<br>나의 대화에 나타난 감정을 살펴봅니다.</p><div class="toolbar">${link('upload','대화 분석 시작 ↗','btn')}${button('demo','예시 데이터 둘러보기','btn secondary')}</div><p class="small">카카오톡 PC 내보내기 TXT · 본인 화자 직접 선택<br>모델 확률은 감정의 강도나 성격을 의미하지 않습니다.</p></div><div class="landing-art">${card(C.type('pos_1'),false,true)}</div></div><div class="feature-grid"><article class="feature"><span class="feature-num">01 / ANALYZE</span><h3>대화에서 시작하는 이해</h3><p>비텍스트를 제외한 최근 전체 100개 안에서 선택한 화자의 발화만 분석합니다.</p></article><article class="feature"><span class="feature-num">02 / EXPLORE</span><h3>3대분류, 그 안의 7소분류</h3><p>긍정·부정·중립을 먼저 살펴보고, 각 분류의 감정 카드를 펼쳐 보세요.</p></article><article class="feature"><span class="feature-num">03 / CONNECT</span><h3>카드에서 통계로 자연스럽게</h3><p>카드의 수치, 발화별 흐름, 반복 표현을 같은 데이터 기준으로 연결합니다.</p></article></div>${notice('현재 버전은 독립 UI 데모입니다. 운영 3+7 모델 API는 미연결이며 캐릭터 슬롯은 자산 승인 전까지 비워 둡니다.','warning')}</div>`;}
  function stepper(n){return `<div class="stepper">${['파일 선택','본인 화자','분석 실행'].map((t,i)=>`${i?'<span class="rule"></span>':''}<span class="${i===n?'current':''}">${String(i+1).padStart(2,'0')} ${t}</span>`).join('')}</div>`;}
  function upload(){return `<div class="flow-container">${heading('대화 파일을 준비해 주세요','카카오톡 PC 버전에서 내보낸 TXT 파일을 선택합니다.','01 / INPUT')}${stepper(0)}${panel('카카오톡 PC 대화 파일',`<div class="upload-box"><div class="upload-icon" aria-hidden="true">↥</div><h3>대화를 이곳에서 시작하세요</h3><p class="muted">PC 카카오톡 → 대화 내용 내보내기 → 텍스트 파일</p><label for="chat-file" class="sr-only">카카오톡 PC TXT 선택</label><input id="chat-file" class="file-input" type="file" accept=".txt,text/plain"><p class="small muted">TXT · 최대 5MB · UTF-8 / EUC-KR<br>모바일 내보내기와 비텍스트 메시지는 지원하지 않습니다.</p></div>${state.fileName?notice(`${E(state.fileName)} · ${state.parsed?.allText.length||0}개 텍스트 · 최근 ${state.parsed?.recent.length||0}개`,'success'):''}${state.error?notice(E(state.error),'error'):''}<div class="toolbar">${state.parsed?link('speaker','화자 선택으로 →','btn'):''}${button('sample-file','가상 PC TXT로 업로드 흐름 확인','btn secondary')}</div>`)}${notice('파일 내용은 이 브라우저 메모리에서만 파싱하며 외부로 전송하지 않습니다. 실제 감정 분석 API는 연결되지 않았습니다.')}<div class="toolbar">${link('start','← 시작으로')}${button('demo','별도 예시 결과 열기','btn ghost')}</div></div>`;}
  function speaker(){
    if(!state.parsed)return empty('먼저 파일을 선택해 주세요','파싱한 화자 목록에서 본인을 직접 선택합니다.',link('upload','파일 선택','btn'));
    return `<div class="flow-container">${heading('대화에서 본인을 선택하세요','이름만으로 사용자를 자동 식별하지 않습니다.','02 / SPEAKER')}${stepper(1)}${panel('분석할 화자',`<div class="notice"><p>전체 텍스트 ${state.parsed.allText.length}개 중 최근 ${state.parsed.recent.length}개를 먼저 선택했습니다. 상대 화자의 발화도 이 범위에 포함됩니다.</p></div><div class="stack">${state.parsed.speakers.map((s,i)=>`<label class="speaker-option"><input type="radio" name="speaker" value="${E(s.name)}" ${state.speaker===s.name?'checked':''} ${!s.recent?'disabled':''}><div><div class="speaker-name">${E(s.name)}</div><div class="small muted">최근 범위 ${s.recent}개 · 파일 전체 ${s.total}개</div></div></label>`).join('')}</div>${state.error?notice(E(state.error),'error'):''}<div class="toolbar">${button('analyze','선택한 화자로 분석하기 →','btn',state.speaker?'':'disabled')}${link('upload','파일 교체')}</div>`)}${notice('선택 화자의 최대 3개 발화를 한 발화씩 이동하며 첫 발화에 연결합니다. 상대 화자는 감정 분석 대상이 아닙니다.')}</div>`;
  }
  function progress(){
    const n=state.parsed&&state.speaker?C.selectTarget(state.parsed,state.speaker).length:43;
    return `<div class="flow-container">${heading('대화의 모먼트를 찾습니다','구조화된 통계를 먼저, 설명과 이미지는 독립적으로 처리합니다.','03 / ANALYSIS')}${stepper(2)}${panel('분석 단계',`<div class="stack">${[['PC TXT 파싱','화자·텍스트·시간 정보를 확인했습니다.'],['대상 범위 확정',`최근 전체 최대 100개 중 선택 화자 ${n}개`],['3+7 모델 분석','7개 전체 확률 → 합산한 3대분류'],['설명·이미지 준비','통계 결과와 분리된 부가 단계']].map(([title,sub],i)=>`<div class="progress-step ${i<2?'done':''}"><span class="progress-number">${i<2?'✓':i+1}</span><div><h3>${title}</h3><p class="small muted">${sub}</p></div></div>`).join('')}</div>${notice('운영 3+7 API가 아직 연결되지 않아 실제 파일 분석을 실행할 수 없습니다. 현재 저장소의 6분류 API를 새 분류로 변환하지 않습니다.','error','모델 연결 대기')}<div class="toolbar">${button('retry-analysis','연결 다시 확인','btn')}${link('speaker','화자 변경')}${button('demo','별도 예시 데이터 열기','btn secondary')}</div>${state.progress==='retried'?notice('연결 가능한 3+7 endpoint가 설정되지 않았습니다. 선택한 파일과 화자는 유지됩니다.','warning'):''}`)}</div>`;
  }
  function overview(){
    const guard=guards();if(guard)return guard;const s=summary(),leaf=C.type(s.dominantLeaf),p=C.parent(s.dominantParent);
    return `${heading(`${E(state.result.speaker)}님의 대화 모먼트`,'대표 결과에서 출발해, 감정 유형과 분석 근거를 탐색하세요.','04 / OVERVIEW')}${resultNotice()}<div class="hero-grid"><section class="representative"><div class="rep-copy"><div class="eyebrow">YOUR MOMENT CARD</div><h2>${leaf.name}의 모먼트</h2><p class="muted small">최다 소분류 ${leaf.name} ${C.percent(s.leaf[leaf.id])}<br>대표 대분류 ${p.name} ${C.percent(s.parents[p.id])}</p>${link('detail','카드 상세 보기 ↗','btn gold',leaf.id)}</div>${card(leaf,false,true)}</section><div class="metric-grid"><div class="metric"><span class="metric-label">대표 대분류 · 자식 합계</span><span class="metric-value">${p.name} ${C.percent(s.parents[p.id])}</span><span class="metric-note">3대분류에서 독립 계산</span></div><div class="metric"><span class="metric-label">최다 소분류 · 전체 기준</span><span class="metric-value">${leaf.name} ${C.percent(s.leaf[leaf.id])}</span><span class="metric-note">7소분류에서 독립 계산</span></div><div class="metric"><span class="metric-label">최근 전체 텍스트</span><span class="metric-value">${state.result.recentCount}<small>개</small></span><span class="metric-note">상대 화자 발화 포함</span></div><div class="metric"><span class="metric-label">선택 화자 유효 표본</span><span class="metric-value">${s.validCount}<small>개</small></span><span class="metric-note">대상 ${state.result.target.length}개 · 윈도우 최대 3개</span></div></div></div>${parentSelector()}<div class="two-col">${panel('감정 분포',`<div class="step-label"><span class="step-pill">2</span><strong>${state.parentId&&state.parentId!=='all'?C.parent(state.parentId).name+'의 소분류':'3대분류에서 7소분류로'}</strong></div>${stacked()}${state.parentId?bars(s,state.parentId):'<p class="muted small">위 대분류를 선택하면 해당 소분류를 펼쳐 봅니다.</p>'}`,link('distribution','분포 탐색 ↗','btn ghost'))}${panel('발화 순서별 감정 흐름',`${chart(state.result.rows,{view:'all'})}`,link('flow','상세 흐름 ↗','btn ghost'),'긍정·부정·중립 3계열 · 전체 기준')}</div>${panel('감정 도감 미리보기',`<p class="small muted">7개의 안정된 유형 번호입니다. 보유 기록이나 수집률을 의미하지 않습니다.</p><div class="card-grid preview">${C.TYPES.map(t=>card(t,true)).join('')}</div>`,link('cardex','도감 탐색 ↗','btn ghost'))}<div class="two-col">${panel('반복 표현',expressionRows(3),link('repeats','모두 보기 ↗','btn ghost'),'원본 발화 기준 · 등장 발화 수와 총 출현 구분')}${panel('관찰된 결과',`<p class="explanation">${E(C.narrative(state.result))}</p><p class="small muted">대표 대분류와 최다 소분류는 서로 다를 수 있습니다.</p>`,link('summary','종합 결과 ↗','btn ghost'))}</div>`;
  }
  function filteredTypes(){return C.filterTypes({parentId:state.parentId||'all',query:state.query,sort:state.sort,summary:summary()});}
  function filters(){return `<div class="filters"><div class="field search"><label for="card-search">이름 · ID · 도감 번호 검색</label><input id="card-search" type="search" placeholder="예: 기쁨, pos_1, EC-001" value="${E(state.query)}" autocomplete="off"></div><div class="field sort"><label for="card-sort">정렬</label><select id="card-sort"><option value="number" ${state.sort==='number'?'selected':''}>도감 번호순</option><option value="probability" ${state.sort==='probability'?'selected':''}>전체 확률순</option><option value="name" ${state.sort==='name'?'selected':''}>이름순</option></select></div>${button('reset-filter','필터 초기화','btn secondary')}</div>`;}
  function variants(){return `<div class="stack sm"><span class="small muted">시각적 표현 미리보기 · 분석값은 동일합니다</span><div class="filter-chips" aria-label="카드 표현">${[['base','기본형'],['theme','배경 테마'],['holo','홀로그램'],['frame','특별 프레임']].map(([id,name])=>`<button type="button" class="chip ${state.variant===id?'active':''}" data-variant="${id}" aria-pressed="${state.variant===id}">${name}</button>`).join('')}<button class="chip" type="button" disabled title="승인된 일러스트가 필요합니다">일러스트 · 승인 대기</button></div></div>`;}
  function cardex(gallery=false){
    const guard=guards();if(guard)return guard;
    const list=filteredTypes(),expanded=state.parentId!==null||state.query.trim().length>0;
    return `${heading(gallery?'나의 감정 카드 갤러리':'감정의 일곱 가지 유형',gallery?'같은 감정 ID의 카드 표현을 바꾸고, 분석의 상세를 탐색합니다.':'3대분류를 먼저 선택한 뒤, 각 분류의 소분류 카드를 펼쳐 보세요.',gallery?'06 / GALLERY':'05 / CARDEX')}${resultNotice()}${parentSelector()}${panel(gallery?'카드 컬렉션 탐색':'소분류 도감',`<div class="hierarchy-path"><span class="step-pill">2</span><span>3대분류</span><span>›</span><strong>${state.parentId==='all'?'전체 7소분류':state.parentId?C.parent(state.parentId).name+' · '+C.parent(state.parentId).children.length+'소분류':'분류 선택 대기'}</strong><button type="button" class="chip ${state.parentId==='all'?'active':''}" data-parent="all">전체 7개 비교</button></div>${filters()}${gallery?variants():''}<div id="card-results">${cardResults(list,expanded)}</div>`,badge('7 TYPES','subtle'))}${notice('도감 번호는 유형 식별용입니다. 카드 획득, 희귀도, 영구 보유 및 수집 완성률은 제공하지 않습니다.')}`;
  }
  function cardResults(list,expanded=true){return !expanded?empty('먼저 대분류를 선택해 주세요','긍정 3개, 부정 3개, 중립 1개로 구성됩니다. 검색 또는 전체 7개 비교도 사용할 수 있습니다.'):list.length?`<div class="row spread small muted"><span>${list.length}개 유형 · UI 시연용 표시명</span><span>전체 기준 확률</span></div><div class="card-grid" style="margin-top:16px">${list.map(t=>card(t)).join('')}</div>`:empty('검색 결과 없음','검색어나 분류 조건을 줄여 다시 찾아보세요.',button('reset-filter','검색과 필터 해제','btn'));}
  function detail(){
    const guard=guards();if(guard)return guard;const t=C.type(state.leaf)||C.type('neg_1'),s=summary(),p=C.parent(t.parent),rank=C.TYPES.filter(k=>s.leaf[k.id]>s.leaf[t.id]+1e-9).length+1;
    const ex=state.result.expressions.filter(x=>x.leafCounts[t.id]>0);
    return `${heading(`${t.name} · EC-${t.number}`,`${p.name} › ${t.name} · 안정된 ID ${t.id}`,'07 / DETAIL')}<div class="toolbar">${button('back-cards','← 선택한 목록으로','btn secondary')}${link('overview','전체 분석 결과','btn ghost')}</div>${resultNotice()}<div class="detail-layout"><div class="detail-card"><div data-action="zoom" role="button" tabindex="0" aria-label="카드 확대">${card(t,false,true)}</div><div class="detail-nav">${button('previous-card','← 이전')}${badge('EC-'+t.number,'subtle')}${button('next-card','다음 →')}</div>${button('zoom','카드 확대 ⤢','btn secondary wide')}<p class="card-preview-label">시각 표현은 분석값을 변경하지 않습니다.</p></div><div class="detail-main">${panel('이 카드의 분석 정보',`<div class="detail-facts"><div class="metric"><span class="metric-label">전체 기준 평균 확률</span><span class="big-number">${C.percent(s.leaf[t.id])}</span><span class="metric-note">유효 ${s.validCount}개 평균</span></div><div class="metric"><span class="metric-label">전체 분포 내 위치</span><span class="big-number">${rank}<small> / 7</small></span><span class="metric-note">내림차순 · 동률 공동 순위</span></div></div><div class="facts"><div class="fact"><span>소속 대분류</span><strong>${p.mark} ${p.name} ${C.percent(s.parents[p.id])}</strong></div><div class="fact"><span>감정 유형 ID</span><strong class="mono">${t.id}</strong></div><div class="fact"><span>표시명 · 자산</span><strong>시연용 · 승인 대기</strong></div></div>${variants()}`)}${panel(`${t.name}의 발화별 흐름`,`${chart(state.result.rows,{leaf:t.id})}${button('leaf-flow','이 감정의 상세 흐름으로 ↗','btn secondary')}`)}${panel('관련 반복 표현과 근거',`${ex.length?ex.slice(0,3).map(x=>`<div class="expression"><div><strong>“${E(x.label)}”</strong><p class="small muted">전체 등장 ${x.utteranceFrequency}개 발화 · 총 ${x.totalCount}회</p></div><span class="small">${t.name} 대표 발화 ${x.leafCounts[t.id]}개</span></div>`).join(''):'<p class="muted small">이 소분류가 대표인 발화에 연결된 반복 표현이 없습니다.</p>'}<p class="small muted">반복 표현은 원본 발화 기준이며 모델 윈도우를 중복 집계하지 않습니다. 관련성은 인과관계가 아닙니다.</p>`)}${notice('모델 확률은 상대적 예측값입니다. 감정의 실제 강도, 성격, 건강 상태 또는 카드의 희귀도를 나타내지 않습니다.')}</div></div>`;
  }
  function distribution(){
    const guard=guards();if(guard)return guard;
    return `${heading('큰 분류에서, 더 자세하게','모든 막대는 동일한 전체 기준 0–100% 확률을 사용합니다.','08 / DISTRIBUTION')}${resultNotice()}${panel('1. 대분류 분포',`${stacked()}${parentSelector()}`)}${panel('2. 선택한 대분류의 소분류',`${state.parentId&&state.parentId!=='all'?bars():bars(summary(),'all')}<div class="toolbar"><button type="button" class="chip" data-parent="all">전체 7소분류 비교</button></div><div class="table-wrap"><table class="data-table"><caption class="sr-only">7소분류 전체 기준 확률</caption><thead><tr><th>대분류</th><th>ID</th><th>소분류</th><th>전체 기준</th></tr></thead><tbody>${C.TYPES.map(t=>`<tr><td>${C.parent(t.parent).name}</td><td class="mono">${t.id}</td><th scope="row">${t.name}</th><td class="number">${C.percent(probability(t.id))}</td></tr>`).join('')}</tbody></table></div><p class="small muted">유효 표본 ${summary().validCount}개 확률의 평균입니다. 표시 반올림으로 합계가 100.0%와 다를 수 있습니다. 계산은 반올림 전 값으로 수행합니다.</p>`)}${notice('대표 대분류 '+C.parent(summary().dominantParent).name+'와 최다 소분류 '+C.type(summary().dominantLeaf).name+'는 각각 독립적으로 계산합니다.')}`;
  }
  function flow(){
    const guard=guards();if(guard)return guard;
    const validSegments=state.result.segments;
    return `${heading('대화가 흐르며 달라진 확률','대상 화자의 원본 발화 순서로 살펴봅니다.','09 / FLOW')}${resultNotice()}${panel('발화 순서별 감정 흐름',`${flowControls()}${chart(state.result.rows)}${exactTable(state.result.rows)}<p class="small muted">최대 3발화 윈도우 · 한 발화씩 이동 · 첫 발화 anchor에 결과 연결. 모든 보기의 세로축은 전체 기준 0–100%입니다.</p>`)}${panel('관측된 증가·감소 구간',validSegments.length?validSegments.slice(0,6).map(s=>`<div class="fact"><span>${C.parent(s.id).name} · 발화 ${s.from}–${s.to}</span><strong>${s.delta>0?'+':''}${(s.delta*100).toFixed(1)}%p</strong></div>`).join(''):'<p class="muted small">설정된 기준을 충족하는 구간이 없습니다.</p>',badge('탐지 규칙 적용','subtle'),'연속 최소 3개 · 총 변화 ≥15%p · 작은 역방향 변화 ≤2%p')}${notice('증가·감소는 모델 확률의 변화입니다. 상대방의 말이나 행동을 원인으로 단정하지 않습니다.')}`;
  }
  function periodChart(groups,unit){
    const rows=[];let previous=null;
    const time=key=>Date.parse((unit==='month'?key+'-01':key)+'T12:00:00Z');
    for(const g of groups){
      if(previous){const d=new Date(time(previous.key));if(unit==='month')d.setUTCMonth(d.getUTCMonth()+1);else d.setUTCDate(d.getUTCDate()+(unit==='week'?7:1));const expected=d.toISOString().slice(0,unit==='month'?7:10);if(expected!==g.key)rows.push({order:'기록 없음',status:'missing',timeMs:(time(previous.key)+time(g.key))/2});}
      rows.push({order:g.key,probabilities:g.leaf,status:'valid',timestamp:null,count:g.validCount,timeMs:time(g.key)});previous=g;
    }
    return chart(rows,{view:'all',period:true});
  }
  function period(){
    const guard=guards();if(guard)return guard;const g=C.groupPeriods(state.result.rows,state.periodUnit);
    return `${heading('시간으로 묶어 보는 대화','현재 파일의 유효한 시간 정보가 있는 결과만 집계합니다.','10 / PERIOD')}${resultNotice()}${!g.groups.length?empty('날짜 정보 없음','기간별 분석을 사용할 수 없습니다. 날짜가 없어도 발화 순서별 흐름은 확인할 수 있습니다.',link('flow','발화 순서로 보기','btn')):panel('기간별 감정 추이',`<div class="filter-chips" aria-label="집계 단위">${[['day','일별'],['week','주별'],['month','월별']].map(([id,label])=>`<button type="button" class="chip ${state.periodUnit===id?'active':''}" data-unit="${id}" aria-pressed="${state.periodUnit===id}">${label}</button>`).join('')}</div><p class="small muted">시간 정보 없는 유효 결과 ${g.missing}개 제외 · 기간 내 원본 유효 결과 평균</p>${periodChart(g.groups,state.periodUnit)}<div class="period-list">${g.groups.map(x=>`<article class="period-item"><div class="row spread"><strong>${E(x.key)}${state.periodUnit==='week'?' 시작 주':''}</strong><span class="small muted">표본 ${x.validCount}개</span></div>${stacked(x)}</article>`).join('')}</div>${exactTable(g.groups,'period')}<p class="small muted">주간은 월요일 시작 · 월간은 달력 월. 데이터 없는 구간은 0%나 중립으로 채우지 않습니다.</p>`)}${g.groups.length?panel('선택 범위의 발화 흐름',`${chart(state.result.rows.filter(r=>C.dateKey(r.timestamp)),{view:'all'})}`,link('calendar','날짜 탐색 ↗','btn ghost')):''}`;
  }
  function calendar(){
    const guard=guards();if(guard)return guard;const g=C.groupPeriods(state.result.rows);const map=new Map(g.groups.map(x=>[x.key,x]));
    if(!g.groups.length)return `${heading('감정 캘린더','현재 업로드 파일의 날짜만 탐색합니다.','11 / CALENDAR')}${empty('날짜 정보 없음','날짜를 추정하거나 임의의 날짜에 배치하지 않습니다.',link('flow','발화 순서로 보기','btn'))}`;
    const [year,month]=state.month.split('-').map(Number),first=new Date(Date.UTC(year,month-1,1)),days=new Date(Date.UTC(year,month,0)).getUTCDate();
    const offset=(first.getUTCDay()+6)%7;let cells='';
    for(let i=0;i<offset;i++)cells+='<span></span>';
    for(let d=1;d<=days;d++){const date=state.month+'-'+String(d).padStart(2,'0'),data=map.get(date);cells+=`<button type="button" class="calendar-cell ${data?'has-data':''} ${state.date===date?'selected':''}" data-date="${date}" ${data?'':'disabled'} aria-label="${date} ${data?data.validCount+'개 발화':'기록 없음'}"><span>${d}</span>${data?`<small>${data.validCount}개 발화</small>`:''}</button>`;}
    const selected=map.get(state.date);
    return `${heading('날짜로 다시 펼쳐 보는 모먼트','현재 파일의 날짜이며 장기 누적 기록이 아닙니다.','11 / CALENDAR')}${resultNotice()}<div class="two-col">${panel('감정 캘린더',`<div class="calendar-head">${button('prev-month','‹','icon-button','aria-label="이전 달"')}<h3>${year}년 ${month}월</h3>${button('next-month','›','icon-button','aria-label="다음 달"')}</div><div class="calendar-grid">${['월','화','수','목','금','토','일'].map(t=>`<div class="calendar-weekday">${t}</div>`).join('')}${cells}</div><p class="small muted">테두리 셀: 현재 파일에 유효한 표본 있음<br>빈 날짜: 기록 없음 · 0%나 중립을 의미하지 않음</p>`)}${panel(selected?`${state.date} 상세`:'선택한 날짜 없음',selected?`<div class="row spread"><span class="small muted">현재 파일의 유효 발화</span><strong>${selected.validCount}개</strong></div>${stacked(selected)}${bars(selected,'all')}`:empty('기록 없음','발화가 있는 날짜를 선택해 주세요.'))}</div>${selected?panel('선택일 발화별 흐름',`${chart(selected.rows,{view:'all'})}${exactTable(selected.rows)}`):''}`;
  }
  function repeats(){
    const guard=guards();if(guard)return guard;
    return `${heading('대화에 자주 등장한 표현','서로 다른 원본 발화의 3% 이상, 최소 2개 발화에서 등장한 후보입니다.','12 / EXPRESSIONS')}${resultNotice()}${notice('데모는 공백 기준 1–3gram 후보를 계산합니다. SDS의 Kiwi 형태소 분석·불용어 처리는 운영 API 연결 단계입니다.','warning')}${panel('반복 표현과 연결 통계',state.result.expressions.length?state.result.expressions.slice(0,20).map(x=>`<details class="table-reveal"><summary>“${E(x.label)}” · ${x.utteranceFrequency}/${x.denominator}개 발화 · 총 ${x.totalCount}회</summary><div class="stack" style="padding-top:12px"><p class="small">연결된 유효 결과 ${x.linkedCount}개 · 미연결 ${x.missingCount}개 · 임계 등장 발화 ${x.threshold}개</p><div class="facts">${C.PARENTS.map(p=>`<div class="fact"><span>대표 대분류 ${p.name}</span><strong>${x.parentCounts[p.id]}개 발화</strong></div>`).join('')}</div><p class="small muted">대표 소분류별 개수: ${C.TYPES.map(t=>t.name+' '+x.leafCounts[t.id]+'개').join(' · ')}</p>${x.average?bars({leaf:x.average,parents:C.parentProbabilities(x.average)},'all'):''}</div></details>`).join(''):'<p class="muted">반복 표현 조건을 충족하는 후보가 없습니다.</p>')}${notice('표현과 감정 연결은 해당 원본 발화 anchor의 결과를 사용합니다. 등장 발화 수, 총 출현 횟수, 대표 라벨 개수 및 확률 평균은 서로 다른 지표입니다.')}`;
  }
  function summaryPage(){
    const guard=guards();if(guard)return guard;
    return `${heading('숫자에 근거한 종합 결과','관찰된 감정 확률과 표현만 설명합니다.','13 / SUMMARY')}${resultNotice()}<div class="two-col">${panel('구조화 결과 기반 설명',state.narrative==='error'?`${notice('설명 준비에 실패했습니다. 계산된 통계와 차트는 유지됩니다.','error')}${button('retry-narrative','구조화 사실 설명 다시 준비','btn')}`:`<p class="explanation">${E(C.narrative(state.result))}</p><p class="explanation">${state.result.expressions[0]?`“${E(state.result.expressions[0].label)}”는 ${state.result.expressions[0].utteranceFrequency}개 원본 발화에 ${state.result.expressions[0].totalCount}회 등장했습니다.`:'조건을 충족하는 반복 표현이 없습니다.'}</p><p class="small muted">로컬 구조화 JSON으로 만든 설명입니다. 외부 LLM 호출 결과가 아닙니다.</p>`)}${panel('결과 처리 상태',`<div class="facts"><div class="fact"><span>감정 통계</span>${badge('계산 완료')}</div><div class="fact"><span>사실 설명</span>${badge(state.narrative==='error'?'준비 실패':'로컬 설명')}</div><div class="fact"><span>캐릭터 이미지</span>${badge(state.image==='error'?'요청 실패':'자산 매핑 대기','subtle')}</div></div><p class="small muted">이미지 자산 승인 전 빈 슬롯을 유지합니다. 이미지 실패는 통계를 삭제하지 않습니다.</p><div class="toolbar">${button('fail-narrative','설명 실패 상태 확인','btn secondary')}${button('fail-image','이미지 실패 상태 확인','btn secondary')}</div>`)} </div>${panel('분석 근거',`<div class="facts"><div class="fact"><span>분석 대상</span><strong>${E(state.result.speaker)} · ${state.result.target.length}개 발화</strong></div><div class="fact"><span>분포의 분모</span><strong>유효 결과 ${summary().validCount}개</strong></div><div class="fact"><span>taxonomy_version</span><strong class="small">${E(C.TAXONOMY)}</strong></div><div class="fact"><span>모델 입력 윈도우</span><strong>최대 3개 · stride 1</strong></div></div>`)}${notice('사용자의 성격, 건강 상태, 상대방의 의도나 감정 변화의 원인을 추정하지 않습니다. 행동 조언을 생성하지 않습니다.')}`;
  }
  function states(){return `${heading('결과 상태와 복구','중립, 결과 없음, 분석 불가, 날짜 정보 없음을 구분합니다.','QA / STATES')}<div class="state-grid">${[['neutral','중립 결과','실제 유효한 neutral=100% 예시입니다.'],['empty','결과 없음','대상 결과 자체가 없는 상태입니다.'],['invalid','분석 불가','대상은 있지만 유효 확률이 없는 상태입니다.'],['no-time','날짜 정보 없음','통계와 순서 흐름은 유지하고 날짜 기능을 사용할 수 없습니다.']].map(([mode,title,desc])=>panel(title,`<p class="small muted">${desc}</p>${button('scenario',title+' 예시 열기','btn secondary',`data-mode="${mode}"`)}`)).join('')}</div>${panel('부가 결과의 부분 실패',`<p class="small muted">통계 상태와 분리된 설명·이미지 실패를 종합 결과 화면에서 확인할 수 있습니다.</p>${button('partial','부분 성공 예시 열기','btn')}`)}${notice('이 화면은 QA용 가상 상태를 전환합니다. 실제 모델이나 API 응답을 생성하지 않습니다.','warning')}`;}
  function sidebar(){
    const groups=[['EXPLORE',['overview','cardex','gallery']],['ANALYSIS',['distribution','flow','period','calendar','repeats','summary']]];
    return `<aside class="sidebar"><a href="#start" class="brand"><span class="brand-symbol">M</span><span class="brand-copy">MOMENT CARD<br><span class="brand-sub">EMOTION CARDEX</span></span></a>${groups.map(([name,ids])=>`<nav class="nav-group" aria-label="${name}"><span class="nav-caption">${name}</span>${ids.map(id=>`<a href="${href(id)}" class="nav-link ${state.route===id?'active':''}" ${state.route===id?'aria-current="page"':''} title="${routes[id]}"><span class="nav-icon" aria-hidden="true">${icons[id]}</span><span class="nav-label">${routes[id]}</span></a>`).join('')}</nav>`).join('')}<div class="sidebar-foot">${link('upload','＋ 새로운 대화 분석','btn gold')}<a class="small" href="#states">ⓘ 상태와 복구</a><p class="small">3 PARENTS · 7 TYPES<br>유형별 도감 · TCG EDITION</p></div></aside>`;
  }
  function mobileNav(){return `<nav class="mobile-nav" aria-label="모바일 주요 메뉴">${[['overview','요약'],['cardex','도감'],['gallery','갤러리'],['flow','흐름']].map(([id,label])=>`<a href="${href(id)}" class="${state.route===id?'active':''}" ${state.route===id?'aria-current="page"':''}><span class="nav-icon" aria-hidden="true">${icons[id]}</span>${label}</a>`).join('')}<button type="button" data-action="more" aria-haspopup="dialog"><span class="nav-icon" aria-hidden="true">☰</span>더보기</button></nav>`;}
  function render(focus=false){
    const active=document.activeElement;let restore=null;
    if(active&&app.contains(active)){if(active.id)restore='#'+CSS.escape(active.id);else{for(const key of ['data-action','data-parent','data-view','data-series','data-variant','data-unit','data-date'])if(active.hasAttribute(key)){restore='['+key+'=\"'+CSS.escape(active.getAttribute(key))+'\"]';break;}if(!restore&&active.name==='speaker')restore='input[name=\"speaker\"][value=\"'+CSS.escape(active.value)+'\"]';}}
    const view={start,upload,speaker,progress,overview,cardex:()=>cardex(false),gallery:()=>cardex(true),detail,distribution,flow,period,calendar,repeats,summary:summaryPage,states}[state.route]||start;
    document.title=`${routes[state.route]||'시작'} · MOMENT CARD`;
    app.innerHTML=`<div class="app-shell">${sidebar()}<div class="workspace"><header class="context-header"><a class="brand mobile-brand" href="#start"><span class="brand-symbol">M</span><span class="brand-copy">MOMENT CARD</span></a><div class="breadcrumb">Emotion Cardex <span style="margin:0 10px">/</span> ${routes[state.route]}</div><div class="header-actions"><label class="theme-control" for="theme-preference"><span class="theme-control-label">표시 모드</span><select id="theme-preference" aria-label="표시 모드"><option value="system">시스템</option><option value="light">라이트</option><option value="dark">다크</option></select></label>${state.result?badge('예시 데이터','demo'):badge('TCG EDITION','demo')}${link('upload','＋ 새 분석','btn secondary')}<span class="avatar" aria-label="예시 화자 민서">민</span></div></header><main class="content" id="main-content">${view()}<footer class="footer-note">MOMENT CARD / EMOTION CARDEX · 3대분류 → 7소분류 · 캐릭터 자산 승인 대기<br>확률은 모델의 상대적 예측값이며 감정의 실제 강도나 성격을 나타내지 않습니다.</footer></main></div>${mobileNav()}</div>`;
    bind();window.CardexTheme?.sync();if(focus)document.querySelector('main h1')?.focus({preventScroll:true});else if(restore)app.querySelector(restore)?.focus({preventScroll:true});
  }
  function navigate(route,leaf){location.hash=href(route,leaf);}
  function parseRoute(){
    const [name,params]=location.hash.slice(1).split('?');
    const route=Object.hasOwn(routes,name)?name:'start';const id=new URLSearchParams(params||'').get('id');
    state.scrolls[state.route]=window.scrollY;state.route=route;
    if(C.type(id))state.leaf=id;
    render(true);const restoreCard=route===state.returnRoute?state.returnFocus:null;requestAnimationFrame(()=>{window.scrollTo(0,state.scrolls[route]||0);if(restoreCard){document.querySelector('[data-card-id=\"'+CSS.escape(restoreCard)+'\"]')?.focus({preventScroll:true});state.returnFocus=null;}});
    document.getElementById('announcer').textContent=(routes[route]||'시작')+' 화면';
  }
  function setDemo(mode='normal',route='overview'){
    state.demoMode=mode;state.result=C.demoResult(mode);state.narrative='success';state.image='unmapped';state.error=null;
    if(location.hash===href(route)){state.route=route;render(true);}else navigate(route);
  }
  function sampleFile(){
    const lines=['민서 님과 카카오톡 대화','저장한 날짜 : 2026-10-29 09:00:00','--------------- 2026년 10월 28일 수요일 ---------------'];
    for(let i=0;i<105;i++)lines.push(`[${i%3===0?'민서':'지우'}] [오전 9:${String(i%60).padStart(2,'0')}] ${i%10===0?'사진':i%3===0?'같이 해보자 오늘 일정 확인했어':'다음에 이야기하자'}`);
    state.parsed=C.parsePC(lines.join('\n'));state.fileName='가상_PC_내보내기.txt';state.speaker=null;state.error=null;render();
  }
  async function acceptFile(file){
    state.error=null;state.parsed=null;state.speaker=null;state.fileName=null;
    try{
      if(!file||!/\.txt$/i.test(file.name))throw new Error('TXT 파일을 선택해 주세요.');
      if(file.size>5*1024*1024)throw new Error('5MB 이하 TXT 파일을 선택해 주세요.');
      const bytes=await file.arrayBuffer();let text;
      try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{text=new TextDecoder('euc-kr',{fatal:true}).decode(bytes);}
      state.parsed=C.parsePC(text);state.fileName=file.name;
    }catch(error){state.error=error.message||'파일을 읽을 수 없습니다.';}
    render();
  }
  function changeCard(delta){
    let list=filteredTypes();if(!list.some(t=>t.id===state.leaf))list=C.TYPES;
    const i=list.findIndex(t=>t.id===state.leaf);const next=list[(i+delta+list.length)%list.length];navigate('detail',next.id);
  }
  function showZoom(){
    const dialog=document.getElementById('zoom-dialog');focusReturn=document.activeElement;
    dialog.innerHTML=`<div class="modal-heading"><h2 id="zoom-title">${C.type(state.leaf).name} 카드 확대</h2>${button('close-zoom','×','icon-button','aria-label="확대 닫기"')}</div>${card(C.type(state.leaf),false,true)}<p class="card-preview-label" style="margin-top:16px">전체 기준 ${C.percent(probability(state.leaf))} · 분석값은 동일합니다.</p>`;
    dialog.querySelector('[data-action="close-zoom"]').onclick=()=>dialog.close();dialog.showModal();
  }
  function showMore(){
    const dialog=document.getElementById('menu-dialog');focusReturn=document.activeElement;
    dialog.innerHTML=`<div class="modal-heading"><h2 id="menu-title">전체 메뉴</h2>${button('close-menu','×','icon-button','aria-label="메뉴 닫기"')}</div><nav class="more-menu">${['start','upload','overview','cardex','gallery','distribution','flow','period','calendar','repeats','summary','states'].map(id=>link(id,routes[id],'')).join('')}</nav>`;
    dialog.querySelector('button').onclick=()=>dialog.close();dialog.querySelectorAll('a').forEach(a=>a.onclick=()=>dialog.close());dialog.showModal();
  }
  function doAction(action,el){
    if(action==='demo')setDemo();
    if(action==='sample-file')sampleFile();
    if(action==='analyze'){if(!state.speaker)return;state.error=null;state.progress='idle';navigate('progress');}
    if(action==='retry-analysis'){state.progress='retried';render();}
    if(action==='reset-filter'){state.parentId=null;state.query='';state.sort='number';render();}
    if(action==='previous-card')changeCard(-1);
    if(action==='next-card')changeCard(1);
    if(action==='back-cards'){state.returnFocus=state.leaf;navigate(state.returnRoute);}
    if(action==='leaf-flow'){state.flowView=C.type(state.leaf).parent;state.hiddenSeries=new Set(C.parent(state.flowView).children.filter(id=>id!==state.leaf));navigate('flow');}
    if(action==='zoom')showZoom();
    if(action==='more')showMore();
    if(action==='prev-month'||action==='next-month'){
      const [y,m]=state.month.split('-').map(Number),d=new Date(Date.UTC(y,m-1+(action==='next-month'?1:-1),1));state.month=d.toISOString().slice(0,7);state.date='';render();
    }
    if(action==='fail-narrative'){state.narrative='error';render();}
    if(action==='retry-narrative'){state.narrative='success';render();}
    if(action==='fail-image'){state.image='error';render();}
    if(action==='scenario')setDemo(el.dataset.mode,el.dataset.mode==='no-time'?'period':'overview');
    if(action==='partial'){setDemo('normal','summary');state.narrative='error';state.image='error';if(state.route==='summary')render();}
  }
  function bind(){
    app.querySelectorAll('[data-action]').forEach(el=>{el.addEventListener('click',()=>doAction(el.dataset.action,el));if(el.getAttribute('role')==='button')el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();doAction(el.dataset.action,el);}});});
    app.querySelectorAll('[data-parent]').forEach(el=>el.addEventListener('click',()=>{state.parentId=el.dataset.parent;render();}));
    app.querySelectorAll('[data-card-id]').forEach(el=>el.addEventListener('click',()=>{state.returnRoute=state.route==='detail'?state.returnRoute:state.route;state.returnFocus=el.dataset.cardId;}));
    app.querySelectorAll('[data-view]').forEach(el=>el.addEventListener('click',()=>{state.flowView=el.dataset.view;state.hiddenSeries.clear();render();}));
    app.querySelectorAll('[data-series]').forEach(el=>el.addEventListener('change',()=>{el.checked?state.hiddenSeries.delete(el.dataset.series):state.hiddenSeries.add(el.dataset.series);render();}));
    app.querySelectorAll('[data-variant]').forEach(el=>el.addEventListener('click',()=>{state.variant=el.dataset.variant;render();}));
    app.querySelectorAll('[data-unit]').forEach(el=>el.addEventListener('click',()=>{state.periodUnit=el.dataset.unit;render();}));
    app.querySelectorAll('[data-date]:not(:disabled)').forEach(el=>el.addEventListener('click',()=>{state.date=el.dataset.date;render();}));
    app.querySelector('#card-search')?.addEventListener('input',event=>{state.query=event.target.value;const r=app.querySelector('#card-results');r.innerHTML=cardResults(filteredTypes(),true);r.querySelectorAll('[data-card-id]').forEach(el=>el.addEventListener('click',()=>{state.returnRoute=state.route;state.returnFocus=el.dataset.cardId;}));r.querySelector('[data-action="reset-filter"]')?.addEventListener('click',()=>doAction('reset-filter'));});
    app.querySelector('#card-sort')?.addEventListener('change',e=>{state.sort=e.target.value;render();});
    app.querySelector('#chat-file')?.addEventListener('change',e=>acceptFile(e.target.files[0]));
    app.querySelectorAll('input[name="speaker"]').forEach(el=>el.addEventListener('change',()=>{state.speaker=el.value;render();}));
    app.querySelectorAll('[data-tooltip]').forEach(el=>{const show=()=>{el.closest('.chart-wrap').querySelector('.tooltip').textContent=el.dataset.tooltip;};el.addEventListener('mouseenter',show);el.addEventListener('focus',show);el.addEventListener('click',show);});
  }
  document.querySelectorAll('dialog').forEach(d=>d.addEventListener('close',()=>focusReturn?.focus({preventScroll:true})));
  window.addEventListener('hashchange',parseRoute);
  let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>render(),120);});
  // Explicit visual-preview parameters use the same synthetic fixture as the demo button.
  const preview=new URLSearchParams(location.search);
  if(preview.has('preview')){
    state.result=C.demoResult(preview.get('scenario')||'normal');state.parentId=preview.get('parent')||null;
    if(preview.get('leaf')&&C.type(preview.get('leaf')))state.leaf=preview.get('leaf');
    if(['speaker','progress'].includes(preview.get('preview'))){sampleFile();state.speaker='민서';}
    state.route=Object.hasOwn(routes,preview.get('preview'))?preview.get('preview'):'overview';
    history.replaceState(null,'','#'+state.route+(state.route==='detail'?'?id='+state.leaf:''));
  }
  if(!preview.has('preview')){const [r,params]=location.hash.slice(1).split('?');state.route=Object.hasOwn(routes,r)?r:'start';const id=new URLSearchParams(params).get('id');if(C.type(id))state.leaf=id;}
  render();
  // Read-only review hook and deterministic preview setter; never performs inference.
  window.CardexApp={getState:()=>({...state,hiddenSeries:[...state.hiddenSeries]}),preview:(route,options={})=>{state.result=C.demoResult(options.mode||'normal');Object.assign(state,options,{route});render();},routes:Object.keys(routes)};
})();

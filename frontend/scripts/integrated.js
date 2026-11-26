/* Same result object drives the simple card, integrated detail views and exports. */
  const detailRoutes=['analysis','distribution','flow','calendar','period','repeats','gallery','cardex','detail','summary'];
  const detailMenu=[['analysis','분석 요약'],['distribution','감정 분포'],['flow','감정 흐름'],['calendar','캘린더'],['period','일·주·월'],['repeats','반복 표현'],['gallery','카드 도감'],['summary','종합 설명']];
  function syncResultDates(){
    const dates=(state.result?.rows||[]).filter(r=>r.status==='valid').map(r=>C.dateKey(r.timestamp)).filter(Boolean).sort();
    state.date=dates.at(-1)||'';state.month=state.date.slice(0,7)||new Date().toISOString().slice(0,7);
  }
  function simpleOverview(){
    if(!state.result)return heading('나의 감정 카드','기록을 입력하거나 예시로 화면을 먼저 살펴보세요.')+link('start','기록 입력하기','btn')+examples();
    const guard=guards();if(guard)return guard;
    const a=summary(),leaf=C.type(a.dominantLeaf);
    return `<section class="simple-result" aria-label="나의 감정 카드"><div class="simple-card-hero">${card(leaf,false,true)}<span class="badge demo">예시 데이터 · 실제 입력 분석 아님</span></div><div class="simple-result-copy"><h1 class="sr-only" tabindex="-1">기록 속 ${E(leaf.name)}의 모먼트</h1><div class="simple-result-actions">${button('open-share','카드 편집·공유','btn')}${link('analysis','상세 분석 보기 →','btn secondary')}</div><details class="simple-extra-info"><summary>이 카드의 의미</summary><p>예시 기록 ${a.validCount}개의 전체 기준 평균 확률에서 가장 높은 소분류입니다. 감정의 강도나 성격을 의미하지 않습니다.</p><p>분포·흐름·날짜·반복 표현은 상세 분석에서 같은 결과로 확인합니다.</p></details>${link('start','기록으로 돌아가기','btn ghost')}</div></section>`;
  }
  function simpleShell(){
    const detailed=detailRoutes.includes(state.route);
    document.documentElement.classList.toggle('simple-main-tab',!detailed);
    document.documentElement.classList.remove('simple-detail-tab');
    document.documentElement.classList.toggle('integrated-detail',detailed);
    const nav=app.querySelector('.studio-nav');
    nav.innerHTML=[['start','기록 입력'],['overview','감정 카드'],['analysis','상세 분석']].map(([r,label])=>`<a href="#${r}" class="btn ${state.route===r||(r==='analysis'&&detailed)?'':'secondary'}" ${state.route===r||(r==='analysis'&&detailed)?'aria-current="page"':''}>${label}</a>`).join('');
    app.querySelector('.mobile-nav')?.remove();
    if(detailed){
      const main=app.querySelector('main');
      main.insertAdjacentHTML('afterbegin',`<div class="detail-return">${link('overview','← 내 감정 카드','btn secondary')}${state.result?button('open-share','이 결과 공유','btn'):''}</div><nav class="detail-nav-tabs" aria-label="상세 분석 메뉴">${detailMenu.map(([r,label])=>`<a href="#${r}" ${state.route===r?'aria-current="page"':''}>${label}</a>`).join('')}</nav>`);
      // The return/share toolbar is added after the base event binding.
      main.querySelector('.detail-return [data-action="open-share"]')?.addEventListener('click',()=>{shareState.origin=state.route;navigate('share');});
    }
  }
  function integratedMiniCalendar(){
    const groups=C.groupPeriods(state.result.rows);
    if(state.result.target.length<2)return `<p class="muted">기록 한 편에는 날짜별 비교를 제공하지 않습니다.</p>${link('distribution','감정 분포 확인','btn secondary')}`;
    if(!groups.groups.length)return `<p class="muted">날짜가 없는 기록입니다. 날짜를 추정하지 않고 기록 순서로 살펴봅니다.</p>${link('flow','기록 순서로 보기','btn secondary')}`;
    return `<p class="small muted">기록이 있는 ${groups.groups.length}일 · 날짜 없는 유효 기록 ${groups.missing}개 제외</p><div class="mini-days">${groups.groups.slice(-7).map(d=>`<button type="button" data-overview-date="${d.key}" aria-label="${d.key}, ${d.validCount}개 기록 상세"><span>${d.key.slice(5)}</span><strong>${d.validCount}개</strong><small>기록 있음</small></button>`).join('')}</div>`;
  }
  function integratedOverview(){
    if(!state.result)return heading('상세 분석','먼저 예시 결과를 선택하거나 기록을 준비해 주세요.')+link('overview','감정 카드로 돌아가기','btn')+examples();
    const guard=guards();if(guard)return guard;
    const a=summary(),leaf=C.type(a.dominantLeaf),parent=C.parent(a.dominantParent);
    const single=state.result.target.length<2,dated=state.result.rows.filter(r=>C.dateKey(r.timestamp));
    const dates=dated.map(r=>C.dateKey(r.timestamp)).sort();
    return `${heading('기록을 더 깊이 살펴보기','카드에서 본 결과를 분포·흐름·날짜와 함께 확인하세요.')}<div class="scope-strip"><strong>예시 데이터 · 실제 입력 분석 아님</strong><span>전체 기록 ${state.result.target.length}개 · 유효 ${a.validCount}개</span><span>${dates.length?dates[0]+' ~ '+dates.at(-1):'날짜 정보 없음'}</span></div><div class="studio-metrics">${[['대표 대분류',parent.name+' '+C.percent(a.parents[parent.id])],['최다 소분류',leaf.name+' '+C.percent(a.leaf[leaf.id])],['유효 기록',a.validCount+'개']].map(([label,value])=>`<section class="panel metric-summary"><p class="muted">${label}</p><strong>${value}</strong><small>전체 기준 · 원본 기록별 확률 평균</small></section>`).join('')}</div><p class="analysis-explainer">대표 대분류는 소분류 확률의 합, 최다 소분류는 7개 중 가장 높은 평균입니다. 두 결과는 다를 수 있습니다.</p><div class="overview-grid"><div class="overview-main">${panel('감정 분포',stacked()+bars(a,'all'),link('distribution','수치와 분류 보기 →','btn ghost'),'3대분류와 7소분류 · 동일한 전체 기준 0–100%')}${panel('기록 순서별 감정 흐름',single?`<p class="muted">기록 한 편에는 변화 추이를 만들지 않습니다. 감정 분포를 확인해 주세요.</p>`:chart(state.result.rows,{view:'all'}),single?'':link('flow','흐름 자세히 →','btn ghost'),'긍정 · 부정 · 중립')}${panel('반복 표현',single?'<p class="muted">복수 기록이 있을 때 기록 간 반복 표현을 확인할 수 있습니다.</p>':expressionRows(3),single?'':link('repeats','표현과 원본 근거 →','btn ghost'),'등장 기록 수와 총 출현 횟수는 서로 다릅니다.')}</div><div class="overview-aside">${panel('같은 결과의 감정 카드',`${card(leaf,false,true)}<p class="small muted">최다 소분류 ${leaf.name} · ${C.percent(a.leaf[leaf.id])}<br>캐릭터 자산은 승인 대기입니다.</p><div class="toolbar">${link('gallery','7종 도감','btn secondary')}${link('overview','카드로 돌아가기','btn')}</div>`)}${panel('날짜별 기록',integratedMiniCalendar(),!single&&dates.length?link('calendar','캘린더 보기 →','btn ghost'):'')}${panel('관찰된 사실',`<p>${E(diarySummaryText())}</p><p class="small muted">구조화된 결과로 만든 로컬 설명입니다.</p>`,link('summary','종합 설명 →','btn ghost'))}</div></div>`;
  }
  function bindIntegrated(){
    app.querySelectorAll('[data-overview-date]').forEach(el=>el.addEventListener('click',()=>{state.date=el.dataset.overviewDate;state.month=state.date.slice(0,7);navigate('calendar');}));
    app.querySelector('#repeat-sort')?.addEventListener('change',e=>{state.repeatSort=e.target.value;render();});
  }

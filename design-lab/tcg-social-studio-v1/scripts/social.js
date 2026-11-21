  function periodDetailChart(unit,key){
    const selected=state.result.rows.filter(r=>C.bucketKey(r.timestamp,unit)===key),summary=C.aggregate(selected),options=state.periodLeaf==='all'?{view:'seven'}:{leaf:state.periodLeaf};
    const context=`<p class="small muted">${E(key)}${unit==='week'?' 시작 주':''} · 유효 발화 ${summary.validCount}개 · 예시 데이터</p>`;
    if(unit==='day')return context+chart(selected,options)+exactTable(selected);
    const groups=new Map(C.groupPeriods(selected,'day').groups.map(x=>[x.key,x]));
    const start=new Date((unit==='month'?key+'-01':key)+'T12:00:00Z'),length=unit==='month'?new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+1,0)).getUTCDate():7,rows=[];
    for(let i=0;i<length;i++){const d=new Date(start);d.setUTCDate(d.getUTCDate()+i);const date=d.toISOString().slice(0,10),g=groups.get(date);rows.push({order:date,timeMs:d.getTime(),status:g?'valid':'missing',probabilities:g?.leaf,count:g?.validCount});}
    return context+chart(rows,{...options,period:true})+`<p class="small muted">날짜가 없는 구간은 공백입니다. 기간 확률은 날짜 평균을 단순 평균하지 않고 원본 유효 발화를 평균합니다.</p>`;
  }
/* Included in app.js's closure by tools/build.mjs. Public data never includes chat text. */
  const shareState={source:null,payload:null,format:'square',frame:'gold',numbers:true,origin:'overview',busy:false,status:'',error:'',blob:null,url:null,epoch:0};
  function clearShare(){shareState.epoch++;if(shareState.url)URL.revokeObjectURL(shareState.url);Object.assign(shareState,{source:null,payload:null,blob:null,url:null,busy:false,status:'',error:''});}
  function publicPayload(result){
    if(!result||result.demo!==true)throw new Error('검증된 3+7 결과가 필요합니다. 현재 운영 API 어댑터는 연결되지 않았습니다.');
    if(result.taxonomy_version!==C.TAXONOMY)throw new Error('분류 버전이 일치하지 않습니다.');
    if(new Set(result.rows.map(r=>r.anchor)).size!==result.rows.length)throw new Error('중복 분석 기준 발화가 있습니다.');
    const a=C.aggregate(result.rows);if(!a.leaf)throw new Error('유효한 분석 결과가 없어 공유 카드를 만들 수 없습니다.');
    const s=result.summary;C.validateProbabilities(s?.leaf);if(s.validCount!==a.validCount||C.PARENTS.some(p=>!Number.isFinite(s.parents?.[p.id])))throw new Error('공유 표본 또는 부모 확률이 올바르지 않습니다.');
    if(!s?.leaf||C.IDS.some(id=>Math.abs(a.leaf[id]-s.leaf[id])>1e-6)||C.PARENTS.some(p=>Math.abs(a.parents[p.id]-s.parents[p.id])>1e-6)||s.dominantLeaf!==a.dominantLeaf||s.dominantParent!==a.dominantParent)throw new Error('카드와 분석 결과의 수치가 일치하지 않습니다. 다시 분석해 주세요.');
    return {dataKind:'design_fixture',validCount:a.validCount,totalCount:a.totalCount,recentCount:result.recentCount,leaf:{...a.leaf},parents:{...a.parents},leafTies:[...a.leafTies],parentTies:[...a.parentTies]};
  }
  function prepareShare(){if(shareState.source===state.result&&shareState.payload)return;clearShare();shareState.payload=publicPayload(state.result);shareState.source=state.result;}
  function sharedNames(p){return {leaf:p.leafTies.map(id=>C.type(id).name).join(' · '),parent:p.parentTies.map(id=>C.parent(id).name).join(' · '),leafId:p.leafTies[0],parentId:p.parentTies[0]};}
  function blogText(){const p=shareState.payload,n=sharedNames(p);return `[예시 데이터] 이번 대화의 모먼트\n최근 전체 텍스트 ${p.recentCount}개 중 선택 화자의 유효 발화 ${p.validCount}개를 분석한 예시입니다.\n대표 대분류: ${n.parent}${shareState.numbers?' '+C.percent(p.parents[n.parentId]):''}\n최다 소분류${p.leafTies.length>1?' 공동 1위':''}: ${n.leaf}${shareState.numbers?' '+C.percent(p.leaf[n.leafId]):''}\n${shareState.numbers?C.PARENTS.map(x=>x.name+' '+C.percent(p.parents[x.id])).join(' · '):'확률 수치는 공개 설정에 따라 제외했습니다.'}\n전체 기준 평균 모델 확률이며 실제 감정 강도나 성격을 뜻하지 않습니다.`;}
  function posterHTML(){const p=shareState.payload,n=sharedNames(p),t=C.type(n.leafId);return `<div class="public-poster ${shareState.format} ${shareState.frame}" aria-label="공개 카드 미리보기"><h2>이번 대화의 모먼트</h2><p class="poster-result">대표 대분류 ${E(n.parent)}${shareState.numbers?' '+C.percent(p.parents[n.parentId]):''} · 최다 소분류 ${E(n.leaf)}${shareState.numbers?' '+C.percent(p.leaf[n.leafId]):''}</p><div class="public-card"><div class="public-id">${p.leafTies.length>1?'공동 1위':'MC—'+t.number} / ${E(n.parent)}</div><div class="public-slot" aria-label="캐릭터 자산 승인 대기, 빈 영역"></div><h3>${E(n.leaf)}</h3>${shareState.numbers?`<p>${C.percent(p.leaf[n.leafId])} · 전체 기준 평균 확률</p>`:''}<small>예시 데이터 · 유형 안내</small></div><p class="poster-scope">유효 발화 ${p.validCount}개${p.totalCount>p.validCount?' · 제외 '+(p.totalCount-p.validCount)+'개':''}<br>최근 전체 텍스트 ${p.recentCount}개 중 선택 화자 분석</p><strong class="poster-brand">MOMENT CARD / 예시 데이터</strong></div>`;}
  function shareView(){
    try{prepareShare();}catch(e){return heading('공유할 결과를 확인해 주세요','현재 분석 전체를 기준으로 카드를 만듭니다.')+notice(E(e.message),'error')+button('demo','예시 분석 결과 열기');}
    const p=shareState.payload;return `${heading('내 모먼트 카드 만들기',`공유 범위: 현재 분석 전체 · 유효 발화 ${p.validCount}개 · 예시 데이터`)}<div class="social-grid"><section class="panel"><h2>공개 미리보기 · ${shareState.format==='square'?'1:1':'4:5'}</h2>${posterHTML()}</section><section class="panel share-settings"><h2>공유 설정</h2><fieldset><legend>01 출력 형식</legend>${[['square','SNS 정사각형 1:1'],['portrait','SNS 세로형 4:5']].map(([v,l])=>`<button type="button" class="btn ${shareState.format===v?'':'secondary'}" data-share-format="${v}" aria-pressed="${shareState.format===v}">${l}</button>`).join('')}${link('blog','블로그 이미지 + 글')}</fieldset><fieldset><legend>02 카드 외형</legend><p class="muted small">외형만 바뀌며 분석 결과는 유지됩니다.</p>${[['gold','클래식 골드'],['ink','잉크 프레임']].map(([v,l])=>`<button type="button" class="btn ${shareState.frame===v?'':'secondary'}" data-share-frame="${v}" aria-pressed="${shareState.frame===v}">${l}</button>`).join('')}<label class="public-toggle"><input id="share-numbers" type="checkbox" ${shareState.numbers?'checked':''}> 확률 수치 표시</label></fieldset><fieldset><legend>03 공개 정보</legend><p>표본·분석 범위·예시 표시는 항상 유지됩니다.</p><p>제외: 화자 이름 · 파일명 · 대화방명 · 원문 · 반복 표현</p>${button('share-privacy','공개 항목 확인')}</fieldset></section></div><div class="toolbar export-toolbar">${button('save-png',shareState.busy?'이미지 생성 중…':'PNG 이미지 저장','btn',shareState.busy?'disabled':'')}${button('device-share','기기로 공유','btn secondary',shareState.busy?'disabled':'')}${button('share-back','취소하고 돌아가기')}</div>${shareFeedback()}<p class="small muted">이미지는 이 기기에서 생성합니다. 다운로드 요청과 실제 기기 저장, SNS 게시 완료는 서로 다릅니다.</p>`;
  }
  function shareFeedback(){return shareState.error?notice(E(shareState.error),'error')+(state.route==='blog'?'':button('save-png','단순 프레임으로 다시 시도','btn secondary','data-simple="true"')):shareState.status?`<p role="status" class="notice success">${E(shareState.status)}</p>`:'';}
  function blogView(){try{prepareShare();}catch(e){return shareView();}return `${heading('블로그에 남길 모먼트','공개 이미지와 사실 요약을 함께 준비하세요.')}<div class="social-grid"><section class="panel"><h2>표지 미리보기</h2>${posterHTML()}</section><section class="panel"><h2>복사할 사실 요약</h2><textarea id="blog-text" readonly rows="12" aria-label="블로그용 사실 요약">${E(blogText())}</textarea><p class="small muted">개인 소감은 게시할 블로그에서 직접 덧붙이세요. 자동 게시하지 않습니다.</p><div class="toolbar">${button('save-png','표지 PNG 저장','btn',shareState.busy?'disabled':'')}${button('copy-blog','요약 복사','btn secondary',shareState.busy?'disabled':'')}${link('share','편집기로')}</div>${shareFeedback()}</section></div>`;}
  function sharePrivacy(){const dialog=document.getElementById('menu-dialog');focusReturn=document.activeElement;dialog.innerHTML=`<div class="modal-heading"><h2 id="menu-title">공유 전 공개 항목 확인</h2><button type="button" class="icon-button" aria-label="닫기">×</button></div><p>공개 항목: 감정 유형${shareState.numbers?'·확률 수치':''}, 유효 발화 수, 전체 분석 범위, 예시 데이터 표시</p><p>제외 항목: 이름·원문·대화방명·파일명·반복 표현</p><p class="small muted">아래 미리보기와 PNG에 동일한 공개 설정을 적용합니다. 원본 대화를 이미지 제작을 위해 전송하지 않습니다.</p>`;dialog.querySelector('button').onclick=()=>dialog.close();dialog.showModal();}
  async function createPosterBlob(){
    const p=shareState.payload,n=sharedNames(p);await document.fonts.ready;
    const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=shareState.format==='square'?1080:1350;
    const g=canvas.getContext('2d');if(!g)throw new Error('이미지 생성 기능을 사용할 수 없습니다.');
    const h=canvas.height,ink='#18283d',muted='#59677b',gold='#aa7e35',cream='#f6f3ea';
    const box=(x,y,w,h,r,fill,stroke)=>{g.beginPath();g.roundRect(x,y,w,h,r);if(fill){g.fillStyle=fill;g.fill();}if(stroke){g.strokeStyle=stroke;g.lineWidth=2;g.stroke();}};
    const text=(s,x,y,size,color=ink,align='center',weight=400,maxWidth=952)=>{g.font=`${weight} ${size}px "IBM Plex Sans KR",sans-serif`;g.fillStyle=color;g.textAlign=align;g.fillText(s,x,y,maxWidth);};
    g.fillStyle=cream;g.fillRect(0,0,1080,h);text('이번 대화의 모먼트',540,110,48,ink,'center',600);
    text(`${n.parent}${shareState.numbers?' '+C.percent(p.parents[n.parentId]):''} · ${n.leaf}${shareState.numbers?' '+C.percent(p.leaf[n.leafId]):''}`,540,178,28,muted);
    const w=shareState.format==='square'?462:588,ch=shareState.format==='square'?582:743,x=(1080-w)/2,y=220,pad=34,c=shareState.frame==='ink'?ink:'#fff';
    box(x,y,w,ch,32,shareState.frame==='ink'?'#fff':ink,shareState.frame==='ink'?ink:gold);
    text(p.leafTies.length>1?'최다 소분류 공동 1위':`MC—${C.type(n.leafId).number} / ${n.parent}`,x+pad,y+52,22,c,'left',600);
    box(x+pad,y+86,w-pad*2,ch*.43,18,null,gold);
    text(n.leaf,x+pad,y+ch*.67,42,c,'left',600,w-pad*2);
    if(shareState.numbers)text(C.percent(p.leaf[n.leafId])+' · 전체 기준 평균 확률',x+pad,y+ch*.79,23,c,'left');
    text('예시 데이터 · 유형 안내',x+pad,y+ch*.9,20,c,'left');
    text(`유효 발화 ${p.validCount}개 · 전체 분석 범위`,540,h-155,25,muted);
    text(`최근 전체 텍스트 ${p.recentCount}개 중 선택 화자 분석`,540,h-113,25,muted);
    text('MOMENT CARD / 예시 데이터',540,h-55,23,ink,'center',600);
    return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('PNG 생성에 실패했습니다.')),'image/png'));
  }
  async function exportPoster(device=false){if(shareState.busy)return;try{prepareShare();}catch(e){shareState.error=e.message;render();return;}const epoch=shareState.epoch;shareState.busy=true;shareState.error='';shareState.status='';render();try{const blob=await createPosterBlob();if(epoch!==shareState.epoch||shareState.source!==state.result)return;if(shareState.url)URL.revokeObjectURL(shareState.url);shareState.blob=blob;shareState.url=URL.createObjectURL(blob);const filename='moment-card-'+(shareState.format==='square'?'1080x1080':'1080x1350')+'.png';const file=new File([blob],filename,{type:'image/png'});
      if(device&&navigator.canShare?.({files:[file]})){try{await navigator.share({files:[file],title:'이번 대화의 모먼트'});shareState.status='기기 공유 요청이 처리되었습니다. SNS 게시 완료 여부는 확인하지 않습니다.';}catch(e){if(e.name==='AbortError')shareState.status='기기 공유를 취소했습니다. 편집 내용과 분석 결과는 유지됩니다.';else throw e;}}
      else{const a=document.createElement('a');a.href=shareState.url;a.download=filename;a.click();shareState.status=(device?'기기 공유가 지원되지 않아 PNG 다운로드를 요청했습니다.':'PNG 생성 완료 · 다운로드를 요청했습니다.')+' 실제 저장 여부는 브라우저에서 확인해 주세요.';}
    }catch(e){shareState.error=e.message||'이미지를 만들지 못했습니다. 분석 결과는 유지됩니다.';}finally{if(epoch===shareState.epoch){shareState.busy=false;render();}}}
  async function copyBlog(){try{prepareShare();const value=blogText();if(!navigator.clipboard?.writeText)throw Error('이 환경에서는 자동 복사를 사용할 수 없습니다. 아래 글을 직접 선택해 복사해 주세요.');await navigator.clipboard.writeText(value);shareState.status='사실 요약을 복사했습니다.';shareState.error='';}catch(e){shareState.error=e.message;shareState.status='';}render();if(shareState.error){const t=document.getElementById('blog-text');t?.focus();t?.select();}}
  function bindSocial(){
    app.querySelectorAll('.share-settings button,.share-settings input').forEach(n=>{n.disabled=shareState.busy;});
    for(const [attr,key] of [['data-share-format','format'],['data-share-frame','frame']])app.querySelectorAll('['+attr+']').forEach(b=>b.addEventListener('click',()=>{shareState[key]=b.getAttribute(attr);shareState.status='';shareState.error='';render();}));
    app.querySelector('#share-numbers')?.addEventListener('change',e=>{shareState.numbers=e.target.checked;shareState.status='';render();});
    app.querySelectorAll('[data-action="open-share"]').forEach(b=>b.onclick=()=>{shareState.origin=state.route;state.scrolls[state.route]=window.scrollY;navigate('share');});
    app.querySelectorAll('[data-action="save-png"]').forEach(b=>b.onclick=()=>{if(b.dataset.simple)shareState.frame='ink';exportPoster();});
    app.querySelectorAll('[data-action="device-share"]').forEach(b=>b.onclick=()=>exportPoster(true));
    app.querySelectorAll('[data-action="copy-blog"]').forEach(b=>b.onclick=copyBlog);
    app.querySelectorAll('[data-action="share-privacy"]').forEach(b=>b.onclick=sharePrivacy);
    app.querySelectorAll('[data-action="share-back"]').forEach(b=>b.onclick=()=>navigate(shareState.origin));
  }

// Included inside the app closure. Controls use the main diary storage.
let incomingBackup = null, backupPlan = null, restoringBackup = false;
function backupPanel() {
  return `<fieldset class="backup-panel"><legend>기록 보관하기</legend>
    <p>기록과 즐겨찾기를 JSON 파일로 보관해요. 초안·예시·화면 설정은 포함하지 않아요.</p>
    <p class="muted">최대 30편 · 편당 10,000자 · 복원 파일 최대 5MiB. 파일에는 일기 원문이 담겨요.</p>
    <div class="row">${btn('export-backup','기록 내보내기')}
    <label class="quiet file-label">백업 파일 선택<input id="backup-file" type="file" accept="application/json,.json"></label></div>
    <div id="backup-preview" role="status">${backupPlan ? `<p>추가 ${backupPlan.added}편 · 동일 ${backupPlan.duplicates}편 · 충돌 ${backupPlan.conflicts}편</p>
      <p>${backupPlan.overLimit ? '합친 기록이 30편을 초과해요.' : backupPlan.conflicts ? '내용이 다른 같은 ID가 있어요. 기존 기록은 유지됩니다.' : '동일 기록은 건너뛰고 새 기록만 추가해요.'}</p>
      ${btn('confirm-import','확인하고 합치기','primary',backupPlan.allowed && backupPlan.added && !restoringBackup ? '' : 'disabled')}${btn('cancel-import','취소')}` : '파일을 선택하면 합칠 내용을 먼저 확인할 수 있어요.'}</div>
  </fieldset>`;
}
function backupFeedback(message, error = false) {
  state.status = message; state.error = error;
  const el = app.querySelector('#feedback');
  if (el) { el.textContent = message; el.setAttribute('role',error ? 'alert' : 'status'); }
}
function bindBenchmark() {
  app.querySelectorAll("[data-month-date]").forEach(b => b.onclick = () => { state.dateFilter=b.dataset.monthDate; state.archiveTab="records"; state.page=0; state.search=""; state.favoritesOnly=false; render(true); });
  const search = app.querySelector('#record-search');
  if (search) {
  search.oncompositionend = () => updateSearch();
  search.oninput = event => { if (!event.isComposing) updateSearch(); };
  function updateSearch() {
    const start = search.selectionStart, end = search.selectionEnd;
    state.search = search.value; state.page = 0; render();
    const next = app.querySelector('#record-search'); next.focus(); next.setSelectionRange(start,end);
  };
  }
  const filter = app.querySelector('#favorites-only');
  if (filter) filter.onchange = () => { state.favoritesOnly = filter.checked; state.page = 0; render(); app.querySelector('#favorites-only').focus(); };
  const input = app.querySelector('#backup-file');
  if (input) input.onchange = async () => {
    incomingBackup = null; backupPlan = null;
    const file = input.files[0]; if (!file) return;
    try {
      if (file.size > MomentBackup.MAX_BYTES) throw Error('백업 파일은 5MiB 이하여야 해요.');
      incomingBackup = MomentBackup.parse(await file.text());
      backupPlan = MomentBackup.merge(state.sessions, incomingBackup);
      render(); backupFeedback('복원 내용을 확인해 주세요. 아직 기록은 변경되지 않았어요.');
    } catch (error) { render(); backupFeedback(error.message,true); }
  };
}
async function benchmarkAction(a) {
  if (a === 'help-write') {
    openInfo('무엇을 쓸까요?', '오늘 잠깐이라도 마음이 편했던 순간은 언제였나요?', app.querySelector('[popovertarget=draft-more]')); return true;
  }
  if (a === 'review-month') {
    state.view='history'; state.archiveTab='stats'; state.cardFilter=null;
    render(true); return true;
  }
  if (a === 'reset-search') { state.search=''; state.favoritesOnly=false; state.dateFilter=''; state.cardFilter=null; state.page=0; render(); return true; }
  if (a === 'favorite') {
    const r = currentRecord(); if (!r) return true;
    const previous = Boolean(r.favorite); r.favorite = !previous;
    if (state.mode === 'real') {
      markChanged();
      if (!await persist()) { r.favorite=previous; render(); return true; }
    }
    render(); app.querySelector('[data-action=favorite]')?.focus(); return true;
  }
  if (a === 'export-backup') {
    try {
      const blob = new Blob([JSON.stringify(MomentBackup.create(state.sessions),null,2)],{type:'application/json;charset=utf-8'});
      const url=URL.createObjectURL(blob), link=document.createElement('a');
      link.href=url; link.download=`moment-backup-${localDate()}.json`; link.click();
      setTimeout(() => URL.revokeObjectURL(url),10000);
      backupFeedback('백업 파일 다운로드를 요청했어요.');
    } catch(error) { backupFeedback(error.message,true); }
    return true;
  }
  if (a === 'cancel-import') { incomingBackup=null; backupPlan=null; render(); return true; }
  if (a === 'confirm-import') {
    if (!incomingBackup || restoringBackup) return true;
    backupPlan=MomentBackup.merge(state.sessions,incomingBackup);
    if (!backupPlan.allowed || !backupPlan.added) { render(); return true; }
    restoringBackup=true; loading=true; render();
    try {
      // Serialize with pending draft writes. Publish merged state only after transaction completion.
      clearTimeout(persistTimer);
      if (generation !== savedGeneration && !await persist()) throw Error('현재 변경을 먼저 저장해 주세요.');
      if (!storeReady) throw Error('저장소를 사용할 수 없어요. 기존 기록은 유지됩니다.');
      await storage.save({...snapshot(),sessions:backupPlan.entries});
      state.sessions=backupPlan.entries.map(r=>({...r,analysis:{status:'pending'}}));
      incomingBackup=null; backupPlan=null;
      state.status='새 기록을 합쳤어요. 기존 기록과 초안은 유지했어요.'; state.error=false;
    } catch(error) { state.error=true; state.status=error.message; }
    finally { restoringBackup=false; loading=false; render(); }
    return true;
  }
  return false;
}

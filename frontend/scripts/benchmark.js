// Included inside the app closure: archive search, calendar day links and small actions.
function bindBenchmark() {
  app.querySelectorAll("[data-month-date]").forEach(b => b.onclick = () => {
    // One record that day: open it directly instead of a one-item list.
    const sameDay = repository.query({ date: b.dataset.monthDate });
    if (sameDay.length === 1) { Object.assign(state, { dateFilter: b.dataset.monthDate, archiveTab: "records", returnToStats: true, entryFrom: "history", selected: sameDay[0].id, recordTab: "card", view: "entry", editing: false, deleteConfirm: false }); render(true); return; }
    state.dateFilter=b.dataset.monthDate; state.archiveTab="records"; state.page=0; state.search=""; state.favoritesOnly=false; render(true); });
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
}
async function benchmarkAction(a) {
  if (a === 'help-write') {
    // Day-based prompt with an optional "other question"; the draft text is never changed.
    let offset = 0;
    const copy = () => DiaryCore.writingPrompt(state.date, offset) + '\n\n질문은 참고용이에요. 떠오르는 대로 자유롭게 적어 보세요.';
    openInfo('무엇을 쓸까요?', copy(), app.querySelector('[popovertarget=draft-more]'));
    const next = app.querySelector('[data-next-prompt]');
    next.hidden = false;
    next.onclick = () => {
      offset++;
      app.querySelector('#info-copy').textContent = copy();
      document.getElementById('announcer').textContent = DiaryCore.writingPrompt(state.date, offset);
    };
    return true;
  }
  if (a === 'review-month') {
    state.view='history'; state.archiveTab='stats'; state.cardFilter=null;
    render(true); return true;
  }
  if (a === 'reset-search') { state.search=''; state.favoritesOnly=false; state.emotionFilter=''; state.dateFilter=''; state.cardFilter=null; state.page=0; render(); return true; }
  if (a === 'favorite') {
    const r = currentRecord(); if (!r) return true;
    const previous = Boolean(r.favorite); r.favorite = !previous;
    if (state.mode === 'real') {
      markChanged();
      if (!await persist()) { r.favorite=previous; render(); return true; }
    }
    render(); app.querySelector('[data-action=favorite]')?.focus(); return true;
  }
  return false;
}

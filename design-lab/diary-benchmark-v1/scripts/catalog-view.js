function cardLabel(r) {
  const c = DiaryCards.resolve(r);
  return c.status === "ready"
    ? CardexCore.parent(CardexCore.type(c.type).parent).name + " · " + CardexCore.type(c.type).name + " " + c.stage + "단계"
    : c.status === "blank"
      ? "빈 카드"
      : c.status === "error"
        ? "분석 실패"
        : "분석 대기";
}
function catalogPanel() {
  const slots = DiaryCards.collection(activeRecords());
  const visible = slots.filter((s) => s.type === state.catalogType);
  const selected = visible.find((s) => s.stage === state.catalogStage);
  return `<p class="muted">${state.mode === "example" ? "예시 도감" : "내 도감"} · 기록에서 만난 감정들 · ${slots.filter(s => s.records.length).length} / ${slots.length}</p><label>감정 <select id="catalog-type">${CardexCore.PARENTS.map(p => `<optgroup label="${p.name}">${p.children.map(id => CardexCore.type(id)).map(t => `<option value="${t.id}" ${t.id === state.catalogType ? "selected" : ""}>${t.name}</option>`).join("")}</optgroup>`).join("")}</select></label><div class="catalog-grid">${visible.map((s) => `<button data-stage="${s.stage}" aria-pressed="${s.stage === state.catalogStage}"><span class="character-placeholder">${s.records.length ? characterSVG(s.type, 'class="catalog-character"') : "?"}</span><strong>${s.stage}단계</strong><small>${["","30~60% 미만","60~90% 미만","90% 이상"][s.stage]}</small><small>${s.records.length ? s.records.length + "편의 연결 기록" : "미발견"}</small></button>`).join("")}</div><p class="muted">단계는 분류 확률 구간이며 감정의 강도가 아니에요.</p><p class="muted">중립에는 객관적 서술·의문·놀람·당황을 포함해요.</p>${selected && !selected.records.length ? '<p>아직 만나지 않은 캐릭터예요.</p>' : '<p>발견한 단계를 누르면 연결 기록을 볼 수 있어요.</p>'}`;
}
function bindCatalog() {
  app.querySelector("#catalog-type")?.addEventListener("change", (e) => {
    state.catalogType = e.target.value;
    state.catalogStage = null;
    render();
    app.querySelector("#catalog-type")?.focus();
  });
  app.querySelectorAll("[data-stage]").forEach(
    (b) =>
      (b.onclick = () => {
        state.catalogStage = +b.dataset.stage;
        const slot = DiaryCards.collection(activeRecords()).find(s => s.type === state.catalogType && s.stage === state.catalogStage);
        if (slot?.records.length) { state.cardFilter = {type:state.catalogType,stage:state.catalogStage}; state.dateFilter = ''; state.page = 0; state.archiveTab = 'records'; }
        render();
      }),
  );
  app.querySelectorAll("[data-record-tab]").forEach(
    (b) =>
      (b.onclick = () => {
        state.recordTab = b.dataset.recordTab;
        render();
      }),
  );
  const bind = (name, fn) => {
    const b = app.querySelector(`[data-action="${name}"]`);
    if (b) b.onclick = fn;
  };
  bind("card-catalog", () => {
    const c = DiaryCards.resolve(currentRecord());
    state.catalogType = c.type;
    state.catalogStage = c.stage;
    state.view = "history";
    state.archiveTab = "catalog";
    state.cardFilter = null;
    render();
  });
  bind("catalog-records", () => {
    state.cardFilter = { type: state.catalogType, stage: state.catalogStage };
    state.dateFilter = "";
    state.page = 0;
    state.archiveTab = "records";
    render();
  });
  if (state.cardFilter && state.archiveTab === "records") {
    app
      .querySelector(".pagination")
      ?.insertAdjacentHTML("beforeend", btn("catalog-back", "도감으로"));
    bind("catalog-back", () => {
      state.cardFilter = null;
      state.archiveTab = "catalog";
      render();
    });
  }
}

function cardLabel(r) {
  const c = DiaryCards.resolve(r);
  return c.status === "ready"
    ? CardexCore.type(c.type).name + " " + c.stage + "단계"
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
  return `<p class="muted">${state.mode === "example" ? "예시 도감" : "내 도감"} · ${slots.filter((s) => s.records.length).length} / 21 · 현재 기록 기준</p><label>감정 <select id="catalog-type">${CardexCore.TYPES.map((t) => `<option value="${t.id}" ${t.id === state.catalogType ? "selected" : ""}>${t.name}</option>`).join("")}</select></label><div class="catalog-grid">${visible.map((s) => `<button data-stage="${s.stage}" aria-pressed="${s.stage === state.catalogStage}"><span class="character-placeholder">${s.records.length ? "✦" : "?"}</span><strong>${s.stage}단계</strong><small>${s.records.length ? s.records.length + "개 기록" : "미발견"}</small></button>`).join("")}</div><p class="muted">캐릭터 디자인은 추후 연결됩니다. 단계는 감정의 강도가 아니에요.</p>${selected ? `<p>${CardexCore.type(selected.type).name} ${selected.stage}단계 · ${["", "30% 이상 ~ 60% 미만", "60% 이상 ~ 90% 미만", "90% 이상"][selected.stage]}</p>${selected.records.length ? btn("catalog-records", "연결된 기록 보기", "primary") : "<p>아직 만나지 않은 캐릭터예요.</p>"}` : "<p>단계를 선택하면 관련 기록을 볼 수 있어요.</p>"}`;
}
function bindCatalog() {
  app.querySelector("#catalog-type")?.addEventListener("change", (e) => {
    state.catalogType = e.target.value;
    state.catalogStage = null;
    render();
  });
  app.querySelectorAll("[data-stage]").forEach(
    (b) =>
      (b.onclick = () => {
        state.catalogStage = +b.dataset.stage;
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

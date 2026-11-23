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
const stageStars = stage => "★".repeat(stage) + "☆".repeat(3 - stage);
// DiaryCards.collection keeps record IDs per slot; the detail sheet needs the records themselves.
const slotRecords = slot => slot.records.map(id => activeRecords().find(r => r.id === id)).filter(Boolean);
// Highest-probability record of a slot, used for the detail card and sharing.
function slotBest(slot) {
  return slotRecords(slot).map(r => ({ record: r, card: DiaryCards.resolve(r) })).sort((a, b) => b.card.score - a.card.score)[0] || null;
}
// Soft UI v1.1 collection (Figma "도감", "도감 · 첫 실행", "도감 · 카드 상세"). Collected slots show
// the best record's mini card; locked slots a grey "?" frame. The .slot data-* contract is unchanged.
function catalogSlot(s, all) {
  const t = CardexCore.type(s.type), got = s.records.length > 0, best = got ? slotBest(s) : null;
  const art = got ? miniCard(best.record, "mc-character catalog-character") : lockedMiniCard(`${t.name} ${s.stage}단계`);
  return `<button type="button" class="slot ${got ? "" : "is-locked"}" data-locked="${!got}"${got ? ` data-grade="stage-${s.stage}" data-emotion="${s.type}"` : ""} data-slot-type="${s.type}" data-stage="${s.stage}" aria-haspopup="dialog" aria-label="${got ? `${E(t.name)} ${s.stage}단계, 연결 기록 ${s.records.length}편, ${E(dotDate(best.record.recordDate))}, 카드 상세 열기` : `미발견, ${E(t.name)} ${s.stage}단계`}"><span class="slot-thumb">${art}</span></button>`;
}
// Parent tabs (전체 27 · 긍정 9 · 부정 9 · 중립 9) narrow the board; emotion chips narrow it to one emotion.
function catalogParent() {
  if (state.catalogType !== "all" && CardexCore.type(state.catalogType)) return CardexCore.type(state.catalogType).parent;
  return CardexCore.PARENTS.some(p => p.id === state.catalogParent) ? state.catalogParent : "all";
}
function catalogPanel() {
  const slots = DiaryCards.collection(activeRecords());
  const found = slots.filter(s => s.records.length).length;
  const all = state.catalogType === "all" || !CardexCore.type(state.catalogType);
  if (all) state.catalogType = "all";
  const parent = catalogParent();
  const tab = (id, label, count) => `<button type="button" role="tab" class="catalog-tab" data-catalog-parent="${id}" aria-selected="${parent === id && all}"><span>${label}</span><b>${count}</b></button>`;
  const tabs = `<div class="catalog-tabs" role="tablist" aria-label="대분류">${tab("all", "전체", slots.length)}${CardexCore.PARENTS.map(p => tab(p.id, p.name, p.children.length * 3)).join("")}</div>`;
  const chip = (id, label, dot = "") => `<button type="button" class="chip" data-catalog-filter="${id}" aria-pressed="${state.catalogType === id}">${dot}${label}</button>`;
  const filters = `<div class="chip-row catalog-filters" role="group" aria-label="감정 선택">${chip("all", "전체")}${CardexCore.PARENTS.map(p => `<span class="filter-group" role="group" aria-label="${p.name}">${p.children.map(id => chip(id, E(CardexCore.type(id).name), `<i class="chip-dot" style="background:var(--card-deep-${id.replace("_", "-")})" aria-hidden="true"></i>`)).join("")}</span>`).join("")}</div>`;
  let grid;
  if (all) {
    const shown = parent === "all" ? slots : slots.filter(s => CardexCore.type(s.type).parent === parent);
    grid = `<div class="catalog-grid collection-grid is-all">${shown.map(s => catalogSlot(s, true)).join("")}</div>`;
  } else {
    const visible = slots.filter(s => s.type === state.catalogType), t = CardexCore.type(state.catalogType);
    const selected = visible.find(s => s.stage === state.catalogStage);
    grid = `<p class="muted">${E(t.name)} · ${CardexCore.parent(t.parent).name} · 3칸 중 ${visible.filter(s => s.records.length).length}칸 수집 · 카드를 누르면 카드 상세가 열려요</p><div class="catalog-grid collection-grid is-type">${visible.map(s => catalogSlot(s, false)).join("")}</div>${selected && !selected.records.length ? '<p role="status">아직 만나지 않은 캐릭터예요.</p>' : ""}`;
  }
  // First run (Figma "도감 · 첫 실행"): the locked grid fades under a veil with one call to action.
  // Real records stay "분석 대기" until the model is connected, so the copy never promises a card per
  // record; writers who already saved get the waiting count and a direct way into the demo binder.
  const saved = state.mode === "real" ? activeRecords().length : 0;
  const demo = state.mode === "real" ? btn("preview-catalog", "시연 모드로 미리 보기", saved ? "primary" : "secondary") : "";
  const empty = found ? "" : saved
    ? `<div class="collection-empty" role="status" data-empty="waiting"><h3>카드가 분석을 기다리고 있어요</h3><p>기록 ${saved}편은 잘 저장됐어요. AI 감정 분석이 연결되면 그날의 감정 카드가 이 바인더에 꽂혀요</p>${demo}</div>`
    : `<div class="collection-empty" role="status" data-empty="first"><h3>아직 모은 카드가 없어요</h3><p>기록을 남기면 감정 분석을 거쳐 그날의 감정 카드가 이 바인더에 꽂혀요${state.mode === "real" ? " · AI 감정 분석은 아직 연결 전이에요" : ""}</p>${btn("write", "첫 기록 남기기", "primary")}${demo}</div>`;
  const progress = found ? `<section class="collect-card" aria-label="수집 현황${state.mode === "example" ? " · 예시 도감" : ""}"><p><strong class="moment-number">${found}</strong><span> / ${slots.length} 수집</span></p><i class="collect-bar" aria-hidden="true"><b style="width:${(found / slots.length) * 100}%"></b></i></section>` : "";
  const legend = '<p class="catalog-legend">단계는 분류 확률 구간(1단계 30~60% 미만 · 2단계 60~90% 미만 · 3단계 90% 이상)이며 감정의 강도가 아니에요. 중립에는 객관적 서술·의문·놀람·당황을 포함해요.</p>';
  return `<div class="catalog-head page-heading"><div class="catalog-heading"><h2 class="catalog-title">모은 마음 카드</h2>${tabs}</div>${progress}</div>${filters}<section class="catalog-board${found ? "" : " is-first-run"}" aria-label="카드 ${slots.length}칸">${empty}<div class="catalog-grid-wrap"${found ? "" : " inert"}>${grid}</div>${found ? legend : ""}</section><div class="catalog-fade" aria-hidden="true"></div>${catalogDetail(slots)}`;
}
// Card detail: the 5:7 card, No. and first date, best probability, the three-stage growth row and the records.
// Stages come from the highest probability, never from how often an emotion was written (domain rule).
function catalogDetail(slots) {
  const d = state.catalogDetail;
  const slot = d && slots.find(s => s.type === d.type && s.stage === d.stage);
  if (!slot || !slot.records.length) return "";
  const t = CardexCore.type(slot.type), best = slotBest(slot);
  const records = slotRecords(slot), first = records.map(r => r.recordDate).sort()[0];
  const growth = [1, 2, 3].map(stage => {
    const got = slots.some(s => s.type === slot.type && s.stage === stage && s.records.length);
    const kind = stage === slot.stage ? "now" : got ? "got" : "locked";
    return `<li data-growth="${kind}"${kind === "now" ? ' aria-current="true"' : ""}><b>${stage}단계</b><span>${kind === "now" ? "지금" : kind === "got" ? "받음" : "잠김"}</span></li>`;
  }).join("");
  // Figma puts a blue growth hint under the tiles; it names the probability band of the next locked
  // stage instead of a record count (stages never come from how often an emotion was written).
  const BAND = { 1: "30~60%", 2: "60~90%", 3: "90% 이상" };
  const next = [1, 2, 3].find(stage => !slots.some(s => s.type === slot.type && s.stage === stage && s.records.length));
  const hint = next ? `최고 확률이 ${BAND[next]}인 ${t.name} 기록이 생기면 ${next}단계 카드가 열려요` : `${t.name} 카드를 3단계까지 모두 모았어요`;
  const rows = records.sort(compareRecords).map(r => `<button type="button" class="detail-row" data-open="${E(r.id)}"><b>${E(dotDate(r.recordDate).slice(5))}</b><span>${E(firstLine(r.text, 40))}</span><i aria-hidden="true">›</i></button>`).join("");
  return `<dialog id="card-detail" class="card-detail" aria-labelledby="card-detail-title"><button type="button" class="detail-back" data-close-detail>도감</button><div class="detail-layout"><div class="detail-stage"><span class="stage-glow" aria-hidden="true"></span><div class="detail-card" data-stage="${slot.stage}" data-grade="stage-${slot.stage}" data-emotion="${slot.type}" aria-hidden="true"><span class="grade-sheen"></span>${cardSVG(best.record, { snippet: false })}</div></div><div class="detail-info"><button type="button" class="quiet detail-close" data-close-detail aria-label="닫기">✕</button><p class="detail-no">${cardNumber(slot.type, slot.stage)} · ${E(dotDate(first))} 획득</p><h2 id="card-detail-title">${E(t.name)}<span class="sr-only"> · ${slot.stage}단계</span></h2><p class="detail-meta">최고 확률 ${Math.round(best.card.score * 100)}% · 임시 분류${state.mode === "example" ? " · 예시" : ""}</p><h3>카드 성장</h3><ol class="growth-row">${growth}</ol><p class="growth-hint">${E(hint)}</p><h3>이 카드가 담긴 기록 <small>${slot.records.length}편</small></h3><div class="detail-records">${rows}</div><p class="detail-fine">분류 확률은 감정의 강도가 아니에요.</p><div class="detail-actions"><button type="button" class="primary" data-share-record="${E(best.record.id)}">공유하기</button><button type="button" class="secondary" data-close-detail>닫기</button></div></div></div></dialog>`;
}
function bindCatalog() {
  app.querySelectorAll("[data-catalog-parent]").forEach(b => (b.onclick = () => {
    state.catalogParent = b.dataset.catalogParent;
    state.catalogType = "all";
    state.catalogStage = null;
    state.catalogDetail = null;
    render();
    app.querySelector(`[data-catalog-parent="${state.catalogParent}"]`)?.focus();
  }));
  app.querySelectorAll("[data-catalog-filter]").forEach(b => (b.onclick = () => {
    state.catalogType = b.dataset.catalogFilter;
    if (state.catalogType === "all") state.catalogParent = "all";
    state.catalogStage = null;
    state.catalogDetail = null;
    render();
    app.querySelector(`[data-catalog-filter="${state.catalogType}"]`)?.focus();
  }));
  app.querySelectorAll(".slot[data-stage]").forEach(
    (b) =>
      (b.onclick = () => {
        const type = b.dataset.slotType, stage = +b.dataset.stage;
        state.catalogStage = stage;
        const slot = DiaryCards.collection(activeRecords()).find(s => s.type === type && s.stage === stage);
        state.catalogDetail = slot?.records.length ? { type, stage } : null;
        state.detailOpener = `.slot[data-slot-type="${type}"][data-stage="${stage}"]`;
        render();
      }),
  );
  const detail = app.querySelector("#card-detail");
  if (detail && !detail.open) {
    detail.showModal();
    detail.addEventListener("close", () => {
      state.catalogDetail = null;
      state.catalogStage = null;
      if (detail.isConnected) {
        const opener = app.querySelector(state.detailOpener || ".slot");
        opener?.focus({ preventScroll: true });
        DiaryFlip.clearWithin(opener);
      }
      detail.remove();
    }, { once: true });
    detail.querySelectorAll("[data-close-detail]").forEach(b => (b.onclick = () => detail.close()));
  }
  app.querySelectorAll("[data-record-tab]").forEach(
    (b) =>
      (b.onclick = () => {
        state.recordTab = b.dataset.recordTab;
        render();
      }),
  );
  // A view can show the same action twice (card menu and card info); bind every copy.
  const bind = (name, fn) => app.querySelectorAll(`[data-action="${name}"]`).forEach(b => (b.onclick = fn));
  // 도감에 넣기 (Figma): cards are collected automatically, so this confirms it and opens the card's detail.
  bind("card-catalog", () => {
    const c = DiaryCards.resolve(currentRecord());
    state.catalogType = c.type;
    state.catalogStage = c.stage;
    state.catalogDetail = c.status === "ready" ? { type: c.type, stage: c.stage } : null;
    showToast("도감에 담겼어요");
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

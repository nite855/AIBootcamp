(() => {
  "use strict";
  const app = document.getElementById("app"),
    E = CardexCore.escapeHTML;
  const localDate = (d = new Date()) =>
    [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0"),
    ].join("-");
  const timeLabel = value => value ? new Date(value).toLocaleTimeString("ko-KR", {hour:"2-digit",minute:"2-digit",hour12:false}) : "";
  const state = {
    view: "write",
    mode: "real",
    catalogType: "all",
    catalogParent: "all",
    catalogStage: null,
    catalogDetail: null,
    homeMonth: localDate().slice(0, 7),
    calendarWeek: DiaryStatistics.weekStart(localDate()),
    writeCalendar: "week",
    calendarDay: "",
    cardModal: null,
    shareFrom: "record",
    shareFormat: "card",
    shareSentence: "",
    shareOpts: { quote: true, date: true, name: true, prob: false },
    revealed: {},
    pendingReveal: null,
    cardFilter: null,
    recordTab: "text",
    policy: "single",
    text: "",
    date: localDate(),
    page: 0,
    search: "",
    favoritesOnly: false,
    sortOldest: false,
    emotionFilter: "",
    archiveTab: "records",
    month: localDate().slice(0, 7),
    dateFilter: "",
    returnToStats: false,
    selected: null,
    editing: false,
    sessions: [],
    preview: false,
    status: "",
    error: false,
    busy: false,
    deleteConfirm: false,
  };
  const objectAssets = /*__OBJECT_ASSETS__*/;
  /*__PERSISTENCE__*/
  // Demo records follow the product's own rules (2026-11-24 critique): one record per day and no more than
  // the 30-record limit, so the month header never reads "기록 48편" under a "최대 30편" warning.
  // Today (day 0) is analyzed so the demo shows today's card and the stats "오늘 긍정" tooltip; day 3 is the
  // pending card. Days 0-2 and 4-27 open every catalog slot (9 types × 3 stages): today is slot 18 (기쁨 3단계),
  // day 1 stays slot 0 (기쁨 1단계, the card the browser tests open). Day 28 is a blank card and day 29 a tie.
  // Failed/stale analyses stay covered by the unit tests (cards.test.cjs).
  const EXAMPLE_COUNT = 30, EXAMPLE_PENDING = 3, EXAMPLE_BLANK = 28, EXAMPLE_TIE = 29, EXAMPLE_TODAY_SLOT = 18;
  const exampleSlot = i => {
    if (i === 0) return EXAMPLE_TODAY_SLOT;
    const k = i < EXAMPLE_PENDING ? i - 1 : i - 2; // days 1-2 → slots 0-1, days 4+ → slots 2+
    return k < EXAMPLE_TODAY_SLOT ? k : k + 1;
  };
  const examples = Array.from({ length: EXAMPLE_COUNT }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return {
      id: "sample-" + i,
      text: [
        "퇴근길에 작은 꽃을 샀다. 별일 없는 하루에도 좋아하는 순간이 있었다.",
        "오랜만에 친구와 산책했다. 천천히 이야기하니 마음이 가벼워졌다.",
        "바쁜 하루 끝, 따뜻한 차 한 잔으로 나를 돌봤다.",
      ][i % 3],
      recordDate: localDate(d),
      createdAt: d.toISOString(),
      updatedAt: d.toISOString(),
      version: 1,
      analysis: i === EXAMPLE_PENDING ? { status: "pending" }
        : {
            status: "valid",
            version: 1,
            taxonomy_version: CardexCore.TAXONOMY,
            probabilities: Object.fromEntries(CardexCore.IDS.map((id, j) => {
              if (i === EXAMPLE_TIE) return [id, j < 2 ? 0.35 : 0.3 / (CardexCore.IDS.length - 2)];
              const slot = exampleSlot(i);
              const score = i === EXAMPLE_BLANK ? 0.2 : [0.45, 0.75, 0.95][Math.floor(slot / CardexCore.IDS.length) % 3];
              return [id, j === slot % CardexCore.IDS.length ? score : (1 - score) / (CardexCore.IDS.length - 1)];
            })),
          },
    };
  });
  const activeRecords = () =>
    state.mode === "example" ? examples : state.sessions;
  const compareRecords = (a, b) => b.recordDate.localeCompare(a.recordDate) || (b.createdAt || "").localeCompare(a.createdAt || "");
  const repository = {
    query({ month = "", date = "" } = {}) {
      return activeRecords()
        .filter(
          (x) =>
            (!month || x.recordDate.startsWith(month)) &&
            (!date || x.recordDate === date) &&
            (!state.cardFilter ||
              (() => {
                const c = DiaryCards.resolve(x);
                return (
                  c.type === state.cardFilter.type &&
                  c.stage === state.cardFilter.stage &&
                  c.status === "ready"
                );
              })()),
        )
        .slice()
        .sort(compareRecords);
    },
    async list() {
      return activeRecords()
        .slice()
        .sort(compareRecords);
    },
    async get(id) {
      return activeRecords().find((x) => x.id === id);
    },
    async save(entry) {
      const i = activeRecords().findIndex((x) => x.id === entry.id);
      if (i < 0) activeRecords().push(entry);
      else activeRecords()[i] = entry;
    },
    async remove(id) {
      const i = activeRecords().findIndex((x) => x.id === id);
      if (i >= 0) activeRecords().splice(i, 1);
    },
  };
  const btn = (action, label, cls = "quiet", attrs = "") =>
    `<button type="button" data-action="${action}" class="${cls}" ${attrs}>${label}</button>`;
  const more = (id, contents, label = "더보기") => `<button type="button" class="quiet more-trigger" popovertarget="${id}" aria-haspopup="true">${label}</button><div id="${id}" class="action-popover" popover>${contents}</div>`;
  function currentRecord() {
    return activeRecords().find((r) => r.id === state.selected);
  }
  const emptyHint = (typing) => typing ? "지금의 마음을 글로 남겨 보세요" : "짧은 한 문장부터 시작해 보세요";
  function emptyCard() {
    const typing = Boolean(String(state.text || "").trim());
    return `<div class="empty-card" data-typing="${typing}" role="img" aria-label="아직 열리지 않은 오늘의 카드"><div class="empty-top"><span class="empty-meta">오늘의 모먼트</span><span class="empty-meta">${E(state.date)}</span></div><div class="empty-art" aria-hidden="true"><span class="empty-spark s1">✦</span><span class="empty-spark s2">✧</span><span class="empty-spark s3">✦</span><img class="empty-silhouette" src="${objectAssets.heart}" alt=""></div><span class="empty-dots" aria-hidden="true">○ ○ ○</span><div class="empty-bottom"><h2>오늘의 기록을<br>기다리고 있어요</h2><p class="empty-hint">${emptyHint(typing)}</p></div></div>`;
  }
  // Shared artwork for cards, archive thumbnails, catalog and PNG export (2026-11-22): the Figma
  // "character · 블롭" (blob-art.js) in the emotion's deep card color. Emotions differ by color only;
  // the old 3D bunny PNGs and the neutral corner badges are gone.
  let blobSeq = 0;
  function characterSVG(type, attrs = "") {
    const emotion = CardexCore.type(type);
    return MomentBlob.blobSVG({ color: cardPalette(emotion.id).deep, uid: "cb" + (++blobSeq), attrs, character: emotion.id });
  }
  // Soft UI v1.1 moment card (Figma "Moment Card", 5:7): MOMENT CARD header with stage dots,
  // a glass window holding the character, and an info band (Emotion · name · first line ·
  // No.0NN · date). Colors come from the fixed card tokens, so every theme shows the same card.
  const CARD_W = 1080, CARD_H = 1512;
  const CARD_FONT = 'font-family="Bricolage Grotesque, Moment Sans, sans-serif"';
  let cardSeq = 0;
  const cssToken = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  function cardPalette(type) {
    const key = String(type).replace("_", "-");
    return { base: cssToken("--card-base-" + key) || "#e9e9ee", mix: cssToken("--card-mix-" + key) || "#f4f4f6", deep: cssToken("--card-deep-" + key) || "#8a8a94" };
  }
  // Collection number: three stages per emotion in core.js order (pos_1 stage 1 = No.001 … neu_3 stage 3 = No.027).
  function cardNumber(type, stage) {
    const index = CardexCore.TYPES.findIndex(t => t.id === type);
    return index < 0 || !stage ? "" : "No." + String(index * 3 + stage).padStart(3, "0");
  }
  function firstLine(text, max) {
    const line = String(text || "").split(/\r?\n/).map(s => s.trim()).find(Boolean) || "";
    const chars = Array.from(line);
    return chars.length > max ? chars.slice(0, max - 1).join("") + "…" : line;
  }
  const dotDate = date => String(date || "").replaceAll("-", ".");
  // Exported images (card PNG, share preview) leave out the diary's first line: { snippet: false }.
  // The share sheet's "감정 이름 표시" off draws the band without the emotion name: { name: false }.
  function cardSVG(record = currentRecord(), { snippet = true, name: showName = true } = {}) {
    const card = DiaryCards.resolve(record), ready = card.status === "ready";
    const type = ready ? CardexCore.type(card.type) : null;
    const name = ready ? type.name : card.status === "blank" ? "빈 카드" : card.status === "error" ? "분석 실패" : "분석 대기";
    const uid = "mc" + (++cardSeq);
    const c = ready ? cardPalette(card.type) : { base: "#e6e6eb", mix: "#f3f3f6", deep: "#9a9aa4" };
    const date = dotDate(record?.recordDate || state.date);
    let dots = "";
    for (const i of [1, 2, 3]) dots += '<circle cx="' + (868 + i * 30) + '" cy="128" r="9" fill="#111114" fill-opacity="' + (ready && i <= card.stage ? 1 : 0.22) + '"/>';
    const parent = ready ? CardexCore.parent(type.parent).name : "";
    const summary = ready
      ? name + " · " + parent + " · " + card.stage + "단계 · 분류 확률 " + Math.round(card.score * 100) + "%" + (card.ties.length > 1 ? " · 공동 최다" : "") + " · 감정의 강도를 뜻하지 않아요"
      : card.status === "pending" ? "분석 대기 · 감정 분석은 준비 중이에요" : card.status === "blank" ? "빈 카드 · 뚜렷한 대표 감정이 없는 기록이에요" : "분석 실패 · 기록은 그대로 읽을 수 있어요";
    const example = state.mode === "example" ? " · 예시 · 실제 입력 분석 아님" : "";
    const art = ready
      // Figma glass-window proportions: floor shadow (.35, blur 3.9 → 13.2 at 1080) and the blob frame at 63% of the window.
      ? '<ellipse cx="540" cy="927.2" rx="210.7" ry="32.2" fill="' + c.deep + '" opacity=".35" filter="url(#' + uid + '-floor)"/>' + characterSVG(card.type, 'x="180.2" y="236.1" width="719.8" height="719.8"')
      : '<text x="540" y="720" text-anchor="middle" ' + CARD_FONT + ' font-weight="800" font-size="250" fill="#ffffff" fill-opacity=".9">?</text>';
    const band = ready
      ? '<text x="96" y="1206" ' + CARD_FONT + ' font-weight="500" font-size="34" fill="#111114" fill-opacity=".55">' + (showName ? "Emotion" : "Moment") + '</text>'
        + '<text x="96" y="1292" font-weight="800" font-size="76" fill="#111114">' + E(showName ? name : "오늘의 카드") + '</text>'
        + '<text x="96" y="1366" font-weight="600" font-size="40" fill="#111114" fill-opacity=".72">' + E(snippet ? firstLine(record?.text, 14) : "") + '</text>'
        + '<text x="984" y="1300" text-anchor="end" ' + CARD_FONT + ' font-weight="800" font-size="62" fill="#111114">' + cardNumber(card.type, card.stage) + '</text>'
        + '<text x="984" y="1366" text-anchor="end" ' + CARD_FONT + ' font-weight="500" font-size="32" fill="#111114" fill-opacity=".6">' + E(date) + '</text>'
      : '<text x="96" y="1206" ' + CARD_FONT + ' font-weight="500" font-size="34" fill="#111114" fill-opacity=".5">잠긴 카드</text>'
        + '<text x="96" y="1292" font-weight="800" font-size="76" fill="#111114" fill-opacity=".72">' + E(card.status === "pending" ? "분석 대기 중" : name) + '</text>'
        + '<text x="984" y="1366" text-anchor="end" ' + CARD_FONT + ' font-weight="500" font-size="32" fill="#111114" fill-opacity=".5">' + E(date) + '</text>';
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + CARD_W + '" height="' + CARD_H + '" viewBox="0 0 ' + CARD_W + ' ' + CARD_H + '" role="img" aria-label="' + E(name) + ' 감정 카드" class="art-card" data-card-record="' + E(record?.id || "") + '" data-card-snippet="' + snippet + '" data-card-name="' + showName + '" data-card-status="' + card.status + '"' + (ready ? ' data-card-type="' + card.type + '" data-card-stage="' + card.stage + '"' : "") + '>'
      + '<desc>' + E(summary + example) + '</desc>'
      + '<defs><linearGradient id="' + uid + '-bg" x1="0" y1="0" x2=".85" y2="1"><stop offset="0" stop-color="' + c.mix + '"/><stop offset=".55" stop-color="' + c.base + '"/><stop offset="1" stop-color="' + c.base + '"/></linearGradient>'
      + '<linearGradient id="' + uid + '-glass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".55"/><stop offset="1" stop-color="#ffffff" stop-opacity=".12"/></linearGradient>'
      + '<filter id="' + uid + '-floor" x="280" y="860" width="520" height="135" filterUnits="userSpaceOnUse"><feGaussianBlur stdDeviation="13.2"/></filter>'
      + '<clipPath id="' + uid + '-clip"><rect width="' + CARD_W + '" height="' + CARD_H + '" rx="96"/></clipPath></defs>'
      + '<g clip-path="url(#' + uid + '-clip)" font-family="Moment Sans, sans-serif">'
      + '<rect width="' + CARD_W + '" height="' + CARD_H + '" fill="url(#' + uid + '-bg)"/>'
      + '<rect y="1100" width="' + CARD_W + '" height="412" fill="' + c.mix + '"/>'
      + '<text x="96" y="142" ' + CARD_FONT + ' font-weight="800" font-size="40" letter-spacing="7" fill="#111114" fill-opacity=".6">MOMENT CARD' + (state.mode === "example" ? " · 예시" : "") + '</text>'
      + '<rect x="866" y="96" width="132" height="64" rx="32" fill="#ffffff" fill-opacity=".7"/>' + dots
      + '<rect x="66" y="206" width="948" height="836" rx="66" fill="url(#' + uid + '-glass)" stroke="#ffffff" stroke-opacity=".75" stroke-width="5"/>'
      + art + band + '</g></svg>';
  }
  // Grade + emotion attributes for every card surface (2026-11-20): the glow takes the emotion's card color
  // (data-emotion → --card-base/--card-deep in grade-effects.css); the grade only changes the effect.
  function gradeAttrs(card) {
    return ' data-grade="' + DiaryCards.grade(card) + '"' + (card && card.status === "ready" && card.type ? ' data-emotion="' + card.type + '"' : "");
  }
  // HTML mini card for week rails, calendars, the catalog and stats (CSS scales it with its width).
  function lockedMiniCard(label, grade = "") {
    return '<span class="mini-card is-locked"' + (grade ? ' data-grade="' + grade + '"' : "") + ' aria-hidden="true"><span class="mc-head">MOMENT CARD</span><span class="mc-window"><span class="mc-q">?</span></span><span class="mc-band"><small>잠긴 카드</small><strong>' + E(label) + '</strong></span></span>';
  }
  function miniCard(record, characterClass = "mc-character") {
    const card = DiaryCards.resolve(record), grade = DiaryCards.grade(card);
    if (card.status !== "ready") return lockedMiniCard(card.status === "pending" ? "분석 대기" : card.status === "blank" ? "빈 카드" : "분석 실패", grade);
    const key = card.type.replace("_", "-");
    let dots = "";
    for (const i of [1, 2, 3]) dots += i <= card.stage ? '<b class="on"></b>' : "<b></b>";
    return '<span class="mini-card"' + gradeAttrs(card) + ' data-type="' + card.type + '" data-stage="' + card.stage + '" style="--mc-base:var(--card-base-' + key + ');--mc-mix:var(--card-mix-' + key + ');--mc-deep:var(--card-deep-' + key + ')" aria-hidden="true">'
      + '<span class="mc-head">MOMENT CARD<i class="mc-dots">' + dots + '</i></span>'
      + '<span class="mc-window">' + characterSVG(card.type, `class="${characterClass}"`) + '</span>'
      + '<span class="mc-band"><small>Emotion</small><strong>' + E(CardexCore.type(card.type).name) + '</strong><em>' + cardNumber(card.type, card.stage) + '</em></span></span>';
  }

  function recordStorageLabel() {
    if (state.mode === "example") return "예시 기록";
    if (lastStorageError || !storeReady) return "기록을 보관하지 못했어요";
    return generation === savedGeneration ? "기록을 보관했어요" : "기록을 보관 중이에요";
  }

  function cardArea() {
    const record=currentRecord(), card=DiaryCards.resolve(record);
    // Back face (Figma "공개 · 뒷면"): the card's color band (MY MOMENT · name · No.), the date and
    // stage, a rule, the full record and a "moment · 눌러서 앞면 보기 ↻" footer.
    const ready = card.status === "ready", key = ready ? card.type.replace("_", "-") : "";
    const backName = ready ? CardexCore.type(card.type).name : card.status === "blank" ? "빈 카드" : card.status === "error" ? "분석 실패" : "분석 대기";
    const backDate = record ? `${record.recordDate.replaceAll("-", ".")} ${weekdayName(record.recordDate)}${ready ? ` · ${card.stage}단계` : ""}` : "";
    const inner=record ? `<div class="flip-scene"><div class="tilt-layer"><div class="flip-inner"><span class="grade-aura" aria-hidden="true"></span><div class="flip-front"><button class="flip-trigger" data-flip="back" type="button" aria-label="카드를 뒤집어 기록 보기">${cardSVG()}<span class="flip-light" aria-hidden="true"></span></button></div><div class="flip-back" role="button" tabindex="-1" aria-label="카드 앞면으로 돌아가기. Enter 또는 스페이스를 누르세요." aria-hidden="true" inert${ready ? ` style="--back-base:var(--card-base-${key});--back-mix:var(--card-mix-${key})"` : ""}><span class="flip-light" aria-hidden="true"></span><div class="back-band"><small>MY MOMENT</small><strong>${E(backName)}</strong>${ready ? `<em>${cardNumber(card.type, card.stage)}</em>` : ""}</div><p class="back-date">${E(backDate)}</p><hr class="back-rule"><h2 class="sr-only">그날의 기록</h2><div class="flip-text" tabindex="0">${E(record.text)}</div><div class="back-foot"><b>moment</b><small>눌러서 앞면 보기 ↻</small></div></div></div></div></div>` : emptyCard();
    return `<section class="card-area"><div class="card-box"${record ? gradeAttrs(card) : ""}>${inner}</div><p class="caption muted">${record ? `카드를 눌러 뒤집어 보세요 ↻<span class="caption-store"> · ${recordStorageLabel()}</span>` : "기록은 보관할 수 있어요."}</p></section>`;
  }


  /*__STATISTICS_VIEW__*/
  function panel() {
    // Soft UI v1.1 profile page (profile-view.js): themes, notices, records export, data, about.
    if (state.view === "settings") return profilePanel();
    if (state.view === "history") return archivePanel();
    if (state.view === "share") return sharePanel();
    const x = activeRecords().find((x) => x.id === state.selected);
    if (!x) {
      state.view = "history";
      return panel();
    }
    // Figma "카드 공개": one centered column — a small back link, the white stage (chip, card, hint),
    // then the copy and actions under it (card-info; the draw hint and wait panel share its slot).
    return `<section class="panel record-panel"><div class="row record-top">${btn("history", state.entryFrom === "write" ? "홈으로" : "목록으로")}<span class="record-date muted">${longDate(x.recordDate)}${state.mode === "example" ? " · 시연 모드" : ""}</span></div><div class="record-layout show-record-card ${state.editing ? "is-editing" : ""}"><div class="record-copy" ${state.editing ? "" : "hidden"}>${state.editing ? `<label for="sample-text">기록 수정</label><textarea class="read-text" id="sample-text">${E(x.text)}</textarea>` : `<div class="read-text">${E(x.text)}</div>`}<div class="row">${state.editing ? btn("save-example", "수정 완료", "primary") + btn("cancel-edit", "취소") : ""}</div></div><div class="card-stage"><span class="stage-glow" aria-hidden="true"></span>${state.editing ? "" : stageChip(x)}${cardArea()}</div>${state.editing ? "" : cardInfo(x)}</div></section>`;
  }

  // #feedback is redrawn on every render, so it is only the visible copy. A new status is spoken once from
  // the live regions outside #app (#announcer polite, #alerter for errors), which re-renders never recreate.
  let spokenStatus = "", lastScreen = null;
  // Browser tab / history title per screen (2026-11-24): the brand button's label used to be the only name.
  function screenTitle() {
    const page = state.view === "write" ? "기록" : state.view === "settings" ? "프로필" : state.view === "share" ? "카드 공유"
      : state.view === "entry" ? "카드" : state.archiveTab === "stats" ? "통계" : state.archiveTab === "catalog" ? "도감" : "지난 기록";
    return `${page} · 오늘의 모먼트`;
  }
  function speakStatus() {
    if (!state.status) { spokenStatus = ""; return; }
    if (state.status === spokenStatus) return;
    spokenStatus = state.status;
    const region = document.getElementById(state.error ? "alerter" : "announcer");
    if (region) region.textContent = state.status;
  }
  function render(focus = false) {
    // The "분석 대기" panel after a save only lives on that card page (share-view.js showWait).
    if (state.view !== "entry") state.pendingReveal = null;
    // Leaving statistics resets its entry motion, so coming back draws the charts again.
    if (state.view !== "history" || state.archiveTab !== "stats") statsAnimKey = null;
    const old = document.activeElement?.dataset.action;
    const focusedId = document.activeElement?.id;
    const selection = ["record-search", "diary-text"].includes(focusedId) ? [document.activeElement.selectionStart, document.activeElement.selectionEnd] : null;
    const openDetails = new Set([...app.querySelectorAll("details[open] > summary")].map(el => el.textContent));
    app.innerHTML = `<div class="shell"><div class="app-scenery" aria-hidden="true"></div><header>${mainNavigation()}</header><main id="main-content" class="workspace ${state.view === "write" ? "write-workspace" : ""}" data-view="${state.view}" data-tab="${currentTab()}">${state.view === "write" ? homeView() : panel()}</main><dialog id="card-modal" class="card-modal" aria-labelledby="card-modal-title"></dialog><dialog id="info-dialog" class="read-dialog" aria-labelledby="info-title"><h2 id="info-title"></h2><p id="info-copy"></p><div class="row"><button type="button" class="quiet" data-next-prompt hidden>다른 질문</button><button type="button" class="quiet" data-close-info>닫기</button></div></dialog><dialog id="confirm-dialog" class="read-dialog" aria-labelledby="confirm-title"><h2 id="confirm-title">삭제 확인</h2><p id="confirm-copy"></p><div class="row"><button type="button" class="quiet" data-confirm="cancel" autofocus>취소</button><button type="button" class="primary" data-confirm="accept">삭제</button></div></dialog><dialog id="read-full-dialog" class="read-dialog" aria-labelledby="full-title"><div class="full-heading"><div><p class="full-date muted"></p><h2 id="full-title">그날의 기록</h2></div><form method="dialog"><button type="submit" class="quiet">닫기</button></form></div><div class="full-text" tabindex="0"></div></dialog><div><p id="feedback" class="status ${state.error ? "error" : ""}">${E(state.status)}</p><footer><span>EVERY DAY IS A LITTLE ART.</span><span>나만의 속도로 기록해요 ✧</span></footer></div></div>`;
    speakStatus();
    // A new screen opens at the top: the window kept the previous screen's scroll, so phones could open a
    // card page with the card's top cut off (2026-11-24). Re-renders of the same screen keep their scroll.
    const screen = `${state.view}:${state.view === "history" ? state.archiveTab : ""}:${state.view === "entry" ? state.selected : ""}`;
    if (lastScreen !== null && screen !== lastScreen) window.scrollTo(0, 0);
    lastScreen = screen;
    document.title = screenTitle();
    app.querySelectorAll("[popover]").forEach(el => el.addEventListener("toggle", e => { if (e.newState === "closed") app.querySelector(`[popovertarget="${el.id}"]`)?.focus(); }));
    app
      .querySelectorAll("[data-action]")
      .forEach((b) => (b.onclick = () => action(b.dataset.action)));
    app.querySelectorAll("[data-open]").forEach(
      (b) =>
        (b.onclick = () => {
          // Remember the origin so the detail page returns there (home or archive).
          if (state.view !== "entry") state.entryFrom = state.view === "write" ? "write" : "history";
          state.catalogDetail = null;
          state.selected = b.dataset.open;
          state.recordTab = "card";
          state.view = "entry";
          state.editing = false;
          state.deleteConfirm = false;
          render(true);
        }),
    );
    DiaryFlip.bind(app);
    app.querySelector('[data-close-info]').onclick=()=>app.querySelector('#info-dialog').close();
    syncWriteControls();
    app.querySelectorAll("details > summary").forEach(el => { if (openDetails.has(el.textContent)) el.parentElement.open = true; });
    bindBenchmark();
    // Soft UI v1.1: one tap applies a theme; its light/dark scheme comes with it.
    app.querySelectorAll("[data-theme-id]").forEach(b => b.onclick = () => {
      if (b.dataset.themeId === CardexTheme.getTheme()) return;
      CardexTheme.setTheme(b.dataset.themeId);
      render();
      app.querySelector(`[data-theme-id="${b.dataset.themeId}"]`)?.focus();
      document.getElementById("announcer").textContent = "선택한 테마를 적용했어요.";
    });
    // Ctrl/⌘+Enter saves from the editor (2026-11-24 critique); it runs the bar's current action, so a failed
    // save retries and today's written state (no save button) does nothing.
    app.querySelector("#diary-text")?.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" || !(e.ctrlKey || e.metaKey) || e.isComposing) return;
      const button = app.querySelector(".write-actions > .primary");
      if (!button || button.disabled || getComputedStyle(button).display === "none") return;
      e.preventDefault();
      action(button.dataset.action);
    });
    app.querySelector("#diary-text")?.addEventListener("input", (e) => {
      state.text = e.target.value;
      state.clearDraftConfirm = false;
      // Typing answers the inline save error; the bar returns to the counter and save status.
      if (state.writeError) {
        state.writeError = null; state.error = false; state.status = "";
        app.querySelector(".write-editor")?.removeAttribute("data-write-error");
        app.querySelector("#write-error")?.remove();
      }
      schedulePersist();
      // "오늘 작성 완료" ends as soon as the text changes (or comes back): re-render the bar and heading.
      const editor = app.querySelector(".write-editor");
      if (editor && editor.dataset.done !== String(editor.dataset.storageError !== "true" && Boolean(todayDone()))) { render(); return; }
      if (editor) editor.dataset.empty = String(!String(state.text || "").trim());
      syncWriteControls();
      const counter = app.querySelector("#char-count");
      if (counter) {
        const c = charCountText(state.text);
        counter.dataset.level = c.level;
        counter.textContent = c.label;
      }
      const empty = app.querySelector(".empty-card");
      if (empty) {
        const typing = Boolean(String(state.text || "").trim());
        if (empty.dataset.typing !== String(typing)) {
          empty.dataset.typing = String(typing);
          empty.querySelector(".empty-hint").textContent = emptyHint(typing);
        }
      }
    });
    bindStatistics();
    bindHome();
    bindProfile();
    bindCatalog();
    bindShare();
    if (!revealCard()) cardEntrance();
    celebrateUnlocks();
    if (loading) app.querySelectorAll("button,textarea,input,select").forEach(el => el.disabled = true);
    if (focus) {
      const target = app.querySelector("h1,h2");
      target?.setAttribute("tabindex", "-1");
      target?.focus();
    } else if (["record-search", "diary-text"].includes(focusedId) && app.querySelector("#" + focusedId)) {
      // A save finishing mid-typing re-renders the editor; keep the caret where the writer is.
      const field=app.querySelector("#" + focusedId); field.focus({preventScroll:true}); field.setSelectionRange(...selection);
    } else if (old)
      app
        .querySelector(`[data-action="${old}"]`)
        ?.focus({ preventScroll: true });
    syncMobileInput();
  }
  // A successful save opens the card page with a sealed "?" card; tapping it flips the card (share-view.js revealCard).
  // ── Data safety (2026-11-24 묶음 D) ──
  // Today's real record, which a save replaces (one record per day).
  function todayRealRecord() { const d = localDate(); return state.sessions.filter(x => x.recordDate === d).at(-1) || null; }
  // "new": no record today · "edit": the editor holds today's record · "replace": another draft would overwrite it.
  function saveKind() {
    const today = todayRealRecord();
    if (!today) return "new";
    return state.currentEntryId === today.id || String(state.text || "").trim() === String(today.text || "").trim() ? "edit" : "replace";
  }
  let savedAs = "new";
  // The editor can stay open past midnight, or be restored on a later day. Its draft then belongs to the
  // new day: an unchanged copy of an earlier day's record is cleared, and unsaved text stays as the new
  // day's draft with a notice. Returns true when the writer should read that notice before saving.
  function rollDate() {
    const today = localDate();
    if (state.date === today) return false;
    state.date = today;
    const current = state.sessions.find(x => x.id === state.currentEntryId);
    const text = String(state.text || "").trim();
    if (!text) { if (current && current.recordDate !== today) { state.currentEntryId = null; state.savedText = null; } return false; }
    state.error = false;
    if (current && current.recordDate !== today && text === String(state.savedText ?? "").trim()) {
      state.text = ""; state.savedText = null; state.currentEntryId = null;
      state.status = "날짜가 바뀌었어요. 지난 기록은 저장돼 있고, 오늘의 새 기록장을 열었어요.";
    } else {
      if (current && current.recordDate !== today) { state.currentEntryId = null; state.savedText = null; }
      state.status = `날짜가 바뀌었어요. 쓰던 내용은 ${longDate(today)} 기록으로 저장돼요. 맞으면 한 번 더 저장해 주세요.`;
    }
    if (storeReady) schedulePersist();
    return true;
  }
  // Validation errors from DiaryCore are written for the analysis API ("비어 있는 기록이 있습니다…삭제해 주세요");
  // the editor shows what the writer can do next instead. Unknown messages pass through unchanged.
  const SAVE_ERROR_TEXT = [
    [/^비어 있는 기록|^입력 내용이 없습니다/, "한 줄만 적어도 저장할 수 있어요. 오늘 있었던 일을 적어 주세요."],
    [/^분석 가능한 텍스트가 없습니다/, "글자나 숫자를 한 자 이상 적어 주세요."],
    [/읽을 수 없는 문자/, "읽을 수 없는 문자가 섞여 있어요. 그 부분을 지우고 다시 저장해 주세요."],
    [/10,000자를 초과/, "10,000자를 넘었어요. 넘친 부분을 줄이면 저장할 수 있어요."],
  ];
  function saveErrorText(message) {
    const hit = SAVE_ERROR_TEXT.find(([pattern]) => pattern.test(String(message || "")));
    return hit ? hit[1] : String(message || "저장하지 못했어요. 다시 시도해 주세요.");
  }
  // A failed save stays on the editor so the error and "다시 시도" remain in place.
  function openSavedCard() {
    const record = state.sessions.find((x) => x.id === state.currentEntryId);
    if (!record) return;
    state.pendingReveal = `real:${record.id}:${record.version}`;
    state.selected = record.id;
    state.entryFrom = "write";
    state.recordTab = "card";
    state.editing = false;
    state.deleteConfirm = false;
    state.catalogDetail = null;
    state.view = "entry";
    waitFocus = true;
  }
  async function action(a) {
    if (loading) return;
    // "시연 모드로 미리 보기" on the empty catalog switches modes but stays on the catalog.
    const previewTo = a === "preview-catalog" ? "catalog" : "records";
    if (a === "preview-catalog") a = "preview";
    let opener = document.activeElement;
    const popover = opener?.closest('[popover]');
    if (popover) { opener = app.querySelector(`[popovertarget="${popover.id}"]`); popover.hidePopover(); opener?.focus(); }
    if (["delete-all", "preview"].includes(a)) hideUndo(); // Undo never crosses a bulk delete or mode switch.
    if (await benchmarkAction(a)) return;
    if (await shareAction(a)) return;
    if(a==='storage-details'){openInfo('저장 오류',lastStorageError || storageMessage,app.querySelector('[data-action=storage-details]'));return;}
    if (a === "catalog") { state.view = "history"; state.archiveTab = "catalog"; state.cardFilter = null; state.catalogDetail = null; render(true); return; }
    // One record per day: a save from a draft that is not today's record replaces today's text and
    // its analysis, so it is confirmed (2026-11-24). Editing today's record itself needs no dialog.
    if (a === "save") {
      if (rollDate()) { render(); return; } // the day changed under the editor; the notice explains
      const kind = saveKind(), today = todayRealRecord();
      const replace = kind === "replace" ? `오늘 이미 남긴 기록("${firstLine(today.text, 24)}")이 지금 쓴 내용으로 바뀌고, 감정 분석도 다시 기다려요. 이전 내용은 되돌릴 수 없어요.` : "";
      if (state.mode === "example") {
        // Saving writes the real draft, so leaving example mode must be explicit.
        const accepted = await confirmAction(`예시 모드를 끄고 지금 쓴 내용을 실제 기록으로 저장합니다. 예시 기록은 실제 기록에 섞이지 않아요.${replace ? " " + replace : ""}`, opener, { title: '실제 기록으로 저장', accept: replace ? '바꿔서 저장' : '실제 기록으로 저장' });
        if (!accepted) return;
      } else if (replace) {
        const accepted = await confirmAction(replace, opener, { title: '오늘 기록 바꾸기', accept: '바꿔서 저장' });
        if (!accepted) return;
      }
      savedAs = kind;
    }
    if (["delete-example", "clear-draft", "delete-all"].includes(a)) {
      const count = state.sessions.length;
      const accepted = await confirmAction(
        a === 'delete-all' ? `이 브라우저의 실제 기록 ${count}편과 작성 중인 초안을 모두 삭제해요. 되돌릴 수 없어요. 테마·프로필 설정과 시연 데이터는 그대로예요.`
          : a === 'clear-draft' ? '작성 중인 초안만 지워요. 저장된 기록은 그대로예요.' : '이 기록을 삭제합니다. 통계와 도감에도 반영됩니다.',
        opener,
        a === 'delete-all' ? { title: '모든 기록 삭제', accept: '모두 삭제' } : a === 'clear-draft' ? { title: '초안 지우기', accept: '지우기' } : undefined);
      if (!accepted) return;
      if (a === 'delete-example') state.deleteConfirm = true;
      if (a === 'clear-draft') state.clearDraftConfirm = true;
      if (a === 'delete-all') state.clearAllConfirm = true;
    }
    if (a === 'cancel-edit') { state.editing = false; render(true); return; }
    state.error = false;
    state.status = "";
    state.writeError = null;
    if (a !== "delete-all") state.clearAllConfirm = false;
    if (a !== "clear-draft") state.clearDraftConfirm = false;
    if (a === "read-full") {
      const r = currentRecord(); if (!r) return;
      const dlg = app.querySelector("#read-full-dialog"), opener = app.querySelector('[data-action="read-full"]');
      dlg.querySelector(".full-date").textContent = r.recordDate;
      dlg.querySelector(".full-text").textContent = r.text;
      // The opener may sit in the closed "자세히 보기" menu; then focus returns to that menu's button.
      const menu = opener?.closest("[popover]")?.id, back = menu ? app.querySelector(`[popovertarget="${menu}"]`) : opener;
      dlg.addEventListener("close", () => back?.focus(), { once: true });
      dlg.showModal(); return;
    }
    if (a === "retry-save") { if (!storeReady) { await restore(); return; } savingRetry=true;syncWriteControls();try{await persist();}finally{savingRetry=false;render();}return; }
    if (a === "clear-draft" || a === "delete-all") {
      // The dialog above is the only confirmation (the old "한 번 더 누르면" second press was unreachable).
      const key = a === "clear-draft" ? "clearDraftConfirm" : "clearAllConfirm";
      state.text = ""; state.savedText = null; state.currentEntryId = null; state[key] = false;
      if (a === "delete-all") { state.sessions = []; state.selected = null; }
      markChanged();
      if (await persist()) state.status = a === "delete-all" ? "모든 기록과 초안을 삭제했어요." : "초안을 지웠어요.";
      render(); return;
    }
    if (a === "archive-records") { state.archiveTab = "records"; state.dateFilter = ""; state.cardFilter = null; state.view = "history"; render(true); return; }
    if (a === "favorite-records") { state.archiveTab = "records"; state.dateFilter = ""; state.cardFilter = null; state.favoritesOnly = true; state.page = 0; state.view = "history"; render(true); return; }
    if (["write", "settings", "history"].includes(a)) {
      if (a === "history" && state.view === "entry" && state.entryFrom === "write") a = "write";
      state.editing = false;
      state.view = a;
      state.deleteConfirm = false;
      if (a === "write") rollDate();
      render(true);
      return;
    }
    if (a === "new-entry") {
      state.text = "";
      state.savedText = null;
      state.currentEntryId = null;
      state.date = localDate();
      state.view = "write";
      // Show the empty editor before the save settles so typing right away is never overwritten.
      render();
      app.querySelector("#diary-text")?.focus();
    }
    if (a === "preview") {
      state.mode = state.mode === "real" ? "example" : "real";
      state.selected =
        activeRecords().find((r) => DiaryCards.resolve(r).status === "ready")
          ?.id || null;
      state.view = "history";
      state.archiveTab = previewTo;
      state.catalogDetail = null;
      state.page = 0;
      state.cardFilter = null;
      state.dateFilter = "";
    }
    if (a === "prev") state.page--;
    if (a === "next") state.page++;
    if (a === "edit-example") {
      state.editing = true;
      state.recordTab = "text";
    }
    if (a === "save-example") {
      try {
        const text = document.getElementById("sample-text").value;
        DiaryCore.validate([{ text }]);
        const entry = await repository.get(state.selected);
        await repository.save({
          ...entry,
          text,
          updatedAt: new Date().toISOString(),
          version: (entry.version || 1) + 1,
          analysis: { status: "pending" },
        });
        state.editing = false;
        state.status = state.mode === "example" ? "예시를 수정했어요." : "기록을 수정했어요.";
        if (state.mode === "real" && state.currentEntryId === entry.id) { state.text = text; state.savedText = text; }
      } catch (e) {
        state.error = true;
        state.status = e.message;
      }
    }
    if (a === "delete-example") {
      if (!state.deleteConfirm) {
        state.deleteConfirm = true;
        state.status = "한 번 더 누르면 이 기록을 삭제해요.";
      } else {
        const index = activeRecords().findIndex(r => r.id === state.selected);
        const deleted = {
          entry: structuredClone(activeRecords()[index]), index, mode: state.mode,
          currentEntryId: state.currentEntryId, savedText: state.savedText,
        };
        await repository.remove(state.selected);
        if (state.mode === "real" && state.currentEntryId === state.selected) { state.currentEntryId = null; state.savedText = null; }
        state.view = state.entryFrom === "write" ? "write" : "history";
        state.deleteConfirm = false;
        if (deleted.entry) showUndo(deleted);
      }
    }
    if (a === "save") {
      try {
        const v = DiaryCore.validate([{ text: state.text }]);
        state.mode = "real";
        state.date = localDate();
        const now = new Date().toISOString();
        const previous =
          state.policy === "single"
            ? state.sessions.filter((x) => x.recordDate === state.date).at(-1)
            : state.sessions.find((x) => x.id === state.currentEntryId);
        if (!previous && state.sessions.length >= DiaryCore.MAX_RECORDS) throw Error("기록은 최대 30편까지 보관할 수 있어요.");
        const entry = {
          id: previous?.id || MomentRecordId.create(),
          favorite: previous?.favorite ?? false,
          text: v.records[0].text,
          recordDate: previous?.recordDate || state.date,
          version: (previous?.version || 0) + 1,
          analysis: { status: "pending" },
          createdAt: previous?.createdAt || now,
          updatedAt: now,
        };
        if (previous) Object.assign(previous, entry);
        else state.sessions.push(entry);
        state.savedText = state.text;
        state.currentEntryId = entry.id;
        state.selected = entry.id;
        state.status =
          "기록을 저장 중이에요. 감정 분석은 준비 중이에요.";
        state.preview = false;
        state.view = "write";
      } catch (e) {
        // The validation error shows inside the write bar, where the writer is looking (2026-11-24 critique:
        // it used to appear only in #feedback below the fold, worded as a domain exception).
        state.error = true;
        state.status = state.writeError = saveErrorText(e.message);
        render();
        document.getElementById("diary-text")?.focus();
        return;
      }
    }
    if (a === "download") {
      if (
        !["ready", "blank"].includes(DiaryCards.resolve(currentRecord()).status)
      )
        return;
      if (state.busy) return;
      state.busy = true;
      render();
      let url;
      try {
        const svg = cardSVG(currentRecord(), { snippet: false });
        await document.fonts.ready;
        url = URL.createObjectURL(
          new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
        );
        const img = new Image();
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = () =>
            reject(Error("이미지를 만들지 못했어요. 다시 시도해 주세요."));
          img.src = url;
        });
        const canvas = document.createElement("canvas");
        canvas.width = CARD_W;
        canvas.height = CARD_H;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw Error("이 브라우저에서는 이미지 저장이 어려워요.");
        ctx.drawImage(img, 0, 0);
        const blob = await new Promise((resolve) =>
          canvas.toBlob(resolve, "image/png"),
        );
        if (!blob) throw Error("이미지를 만들지 못했어요.");
        const downloadURL = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = downloadURL;
        anchor.download = `moment-${currentRecord().id}-${currentRecord().recordDate}.png`;
        anchor.click();
        setTimeout(() => URL.revokeObjectURL(downloadURL), 10000);
        state.status = state.mode === "example" ? "예시 이미지 다운로드를 요청했어요." : "카드 이미지 다운로드를 요청했어요.";
      } catch (e) {
        state.error = true;
        state.status = e.message;
      } finally {
        if (url) URL.revokeObjectURL(url);
        state.busy = false;
      }
    }
    if (["save", "save-example", "delete-example", "new-entry"].includes(a) && state.mode === "real" && !state.error && !state.deleteConfirm) {
      markChanged();
      // Message per action: a delete must never read as "saved".
      const stored = await persist();
      if (stored) state.status = a === "delete-example" ? "기록을 삭제했어요."
        : a === "save-example" || (a === "save" && savedAs === "edit") ? "기록을 수정했어요. 감정 분석은 준비 중이에요."
        : a === "save" && savedAs === "replace" ? "오늘 기록을 지금 내용으로 바꿨어요. 감정 분석은 준비 중이에요."
        : a === "new-entry" ? "" : "기록을 저장했어요. 감정 분석은 준비 중이에요.";
      // A failed save leaves its error in state.status; only a stored change gets the success toast.
      // A new/edited record opens the wait panel, which is the confirmation itself: the toast used to cover
      // its title on phones (2026-11-24 critique), so saves from the editor skip it.
      if (stored && state.status && a !== "new-entry" && a !== "save") showToast(a === "delete-example" ? "삭제했어요" : "저장했어요");
      if (a === "save" && stored && !state.error) openSavedCard();
    }
    render();
  }
  // Undo for a deleted record. The deletion is already saved; undo restores the same id/version and saves again.
  let undoTimer = null;
  const toast = document.getElementById("toast");
  function hideUndo() { clearTimeout(undoTimer); undoTimer = null; if (toast) toast.hidden = true; }
  function showUndo(deleted) {
    if (!toast) return;
    hideUndo();
    toast.querySelector("#toast-copy").textContent = "기록을 삭제했어요.";
    toast.hidden = false;
    // Pause while the pointer or keyboard focus is on the toast (WCAG timing).
    const arm = () => { clearTimeout(undoTimer); undoTimer = setTimeout(hideUndo, 8000); };
    toast.onmouseenter = toast.onfocusin = () => clearTimeout(undoTimer);
    toast.onmouseleave = toast.onfocusout = arm;
    arm();
    toast.querySelector("[data-toast-undo]").onclick = async () => {
      hideUndo();
      if (state.mode !== deleted.mode || activeRecords().some(r => r.id === deleted.entry.id)) return;
      if (deleted.mode === "real" && state.sessions.length >= DiaryCore.MAX_RECORDS) {
        state.error = true; state.status = "보관 한도 30편에 도달해 되돌릴 수 없어요."; render(); return;
      }
      activeRecords().splice(Math.min(Math.max(deleted.index, 0), activeRecords().length), 0, deleted.entry);
      if (deleted.mode === "real" && deleted.currentEntryId === deleted.entry.id) { state.currentEntryId = deleted.currentEntryId; state.savedText = deleted.savedText; }
      state.error = false;
      state.status = "삭제한 기록을 되돌렸어요.";
      if (deleted.mode === "real") { markChanged(); if (!await persist()) state.status = "되돌린 기록을 저장하지 못했어요. 다시 시도를 눌러 주세요."; }
      render(); // speakStatus() announces the result
      app.querySelector("h1,h2")?.focus?.();
    };
  }
  function confirmAction(copy, opener, { title = '삭제 확인', accept = '삭제' } = {}) {
    return new Promise(resolve => {
      const dlg = app.querySelector('#confirm-dialog');
      dlg.querySelector('#confirm-title').textContent = title;
      dlg.querySelector('#confirm-copy').textContent = copy;
      dlg.querySelector('[data-confirm=accept]').textContent = accept;
      dlg.returnValue = "cancel";
      dlg.querySelector('[data-confirm=cancel]').onclick = () => dlg.close('cancel');
      dlg.querySelector('[data-confirm=accept]').onclick = () => dlg.close('accept');
      dlg.addEventListener('close', () => { opener?.focus(); resolve(dlg.returnValue === 'accept'); }, {once:true});
      dlg.showModal();
    });
  }
  function openInfo(title,text,opener){
    const dialog=app.querySelector('#info-dialog');
    dialog.querySelector('#info-title').textContent=title;dialog.querySelector('#info-copy').textContent=text;
    dialog.querySelector('[data-next-prompt]').hidden=true; // Only the writing prompt re-enables it.
    dialog.addEventListener('close',()=>opener?.focus({preventScroll:true}),{once:true});dialog.showModal();
  }
  // Focus hides tabs before the keyboard opens; viewport recovery restores them even without blur.
  const mobileLayout = window.matchMedia("(max-width: 959px)");
  const textInputTypes = new Set(["text", "search", "email", "url", "tel", "password", "number"]);
  let keyboardSession = null, lastInputViewport = null;
  function isTextInput(field) {
    return Boolean(field && (field.isContentEditable || (
      (field.tagName === "TEXTAREA" || (field.tagName === "INPUT" && textInputTypes.has(field.type)))
      && !field.readOnly && !field.matches(":disabled")
    )));
  }
  function syncMobileInput() {
    const root = document.documentElement, field = document.activeElement;
    // Normalize pinch zoom, and handle browsers that resize either or both viewports.
    const viewport = { width: root.clientWidth, height: Math.min(innerHeight, (window.visualViewport?.height || innerHeight) * (window.visualViewport?.scale || 1)) };
    if (!mobileLayout.matches || !isTextInput(field)) keyboardSession = null;
    else {
      const key = field.id || field;
      if (!keyboardSession || (keyboardSession.dismissed && keyboardSession.key !== key)) {
        const baseline = lastInputViewport?.width === viewport.width ? Math.max(lastInputViewport.height, viewport.height) : viewport.height;
        keyboardSession = { key, width: viewport.width, baseline, low: viewport.height, dismissed: false, geometry: null };
      }
      const session = keyboardSession;
      if (session.width !== viewport.width) {
        // Rotation/split-screen starts a new height baseline, not a keyboard-close signal.
        session.width = viewport.width; session.baseline = session.low = viewport.height;
      }
      const threshold = Math.max(120, session.baseline * 0.15);
      if (session.geometry !== null) session.dismissed = !session.geometry;
      else if (session.baseline - viewport.height >= threshold) {
        session.dismissed = false;
        session.low = Math.min(session.low, viewport.height);
      } else if (!session.dismissed && viewport.height - session.low >= threshold) {
        session.dismissed = true;
      }
      // Retain the high-water mark during the next keyboard opening animation.
      session.baseline = Math.max(session.baseline, viewport.height);
      if (!session.dismissed) session.low = Math.min(session.low, viewport.height);
      session.key = key;
    }
    lastInputViewport = viewport;
    root.classList.toggle("mobile-input-active", Boolean(keyboardSession && !keyboardSession.dismissed));
  }
  document.addEventListener("focusin", syncMobileInput, true);
  // Back leaves the input focused on Android; tapping it again must re-arm hiding without focusin.
  document.addEventListener("pointerdown", event => {
    const field = event.target.closest?.("input,textarea,[contenteditable]");
    if (mobileLayout.matches && isTextInput(field)) {
      if (keyboardSession?.dismissed) keyboardSession = null;
      syncMobileInput();
    }
  }, true);
  // Wait for the next focused element, including when a render removes the old input.
  document.addEventListener("focusout", () => requestAnimationFrame(syncMobileInput), true);
  window.addEventListener("pageshow", syncMobileInput);
  mobileLayout.addEventListener("change", syncMobileInput);
  // Optional overlay-keyboard signal; do not change the browser's viewport/overlay policy.
  const virtualKeyboard = navigator.virtualKeyboard;
  virtualKeyboard?.addEventListener("geometrychange", () => {
    syncMobileInput();
    if (keyboardSession) {
      keyboardSession.geometry = virtualKeyboard.boundingRect.height > 0;
      syncMobileInput();
    }
  });

  // 16:9 stage (layout.css): width = min(viewport, height × 16/9), scaled up from the 1440 base.
  function stageMetrics(width, height) {
    const css = getComputedStyle(document.documentElement);
    const num = (name, fallback) => parseFloat(css.getPropertyValue(name)) || fallback;
    const ratio = num("--layout-stage-ratio-w", 16) / num("--layout-stage-ratio-h", 9);
    const desktop = width >= 960;
    const stage = desktop ? Math.min(width, height * ratio) : width;
    const zoom = desktop ? Math.max(1, stage / num("--layout-stage-base", 1440)) : 1;
    const gutter = Math.max(0, (width - stage) / 2);
    return { stage, zoom, gutter };
  }
  function size() {
    const root = document.documentElement;
    const height = window.visualViewport?.height || innerHeight;
    root.style.setProperty("--app-height", height + "px");
    const m = stageMetrics(root.clientWidth || innerWidth, innerHeight);
    root.style.setProperty("--stage-w", m.stage + "px");
    root.style.setProperty("--stage-zoom", String(Math.round(m.zoom * 1000) / 1000));
    root.style.setProperty("--stage-gutter", m.gutter + "px");
    syncMobileInput();
  }
  size();
  window.visualViewport?.addEventListener("resize", size);
  // Responsive CSS/SVG resize without replacing an open menu or focused input.
  window.addEventListener("resize", size);
  // The trend chart has phone and desktop proportions; redraw it when the breakpoint flips.
  window.matchMedia?.("(max-width: 959px)").addEventListener?.("change", () => {
    if (state.view === "history" && state.archiveTab === "stats") render();
  });
  // Coming back to the app after midnight moves the editor to the new day (rollDate); phones that resume a
  // tab without a window focus event report it through visibilitychange.
  const resumeDay = () => {
    if (loading || state.view !== "write" || state.date === localDate()) return;
    rollDate();
    render();
  };
  window.addEventListener("focus", () => { syncMobileInput(); resumeDay(); });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") resumeDay(); });
  window.addEventListener("hashchange", () =>
    history.replaceState(null, "", location.pathname + location.search),
  );
  if (location.hash)
    history.replaceState(null, "", location.pathname + location.search);
  window.addEventListener("cardex-theme-change",()=>{
    CardexTheme.sync();
    app.querySelectorAll(".art-card").forEach(el => {
      const record = activeRecords().find(r => r.id === el.dataset.cardRecord);
      if (!record && el.dataset.cardRecord) return;
      el.outerHTML = cardSVG(record || null, { snippet: el.dataset.cardSnippet !== "false", name: el.dataset.cardName !== "false" });
    });
    app.querySelectorAll(".catalog-character, .mini-art [data-character]").forEach(el => {
      el.outerHTML = characterSVG(el.dataset.character, el.classList.contains("catalog-character") ? 'class="catalog-character"' : "");
    });
    document.getElementById("announcer").textContent="화면 디자인을 적용했어요.";
  });
  render();
  void restore();
  window.DiaryReview = Object.freeze({
    getState: () => structuredClone(state),
    isReady: () => !loading,
    localDate,
  });
})();

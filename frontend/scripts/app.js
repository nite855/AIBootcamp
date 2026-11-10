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
    catalogType: "pos_1",
    catalogStage: null,
    cardFilter: null,
    recordTab: "text",
    policy: "single",
    text: "",
    date: localDate(),
    page: 0,
    archiveTab: "records",
    statsTab: "count",
    month: localDate().slice(0, 7),
    statsDate: "",
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
  const examples = Array.from({ length: 65 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - Math.floor(i / 2));
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
      analysis: i === 0 ? { status: "pending" }
        : i === 63 ? { status: "error" }
        : {
            status: "valid",
            version: i === 64 ? 0 : 1,
            taxonomy_version: CardexCore.TAXONOMY,
            probabilities: Object.fromEntries(CardexCore.IDS.map((id, j) => {
              if (i === 62) return [id, j < 2 ? 0.35 : 0.3 / (CardexCore.IDS.length - 2)];
              const score = i === 61 ? 0.2 : [0.45, 0.75, 0.95][Math.floor((i - 1) / CardexCore.IDS.length) % 3];
              return [id, j === (i - 1) % CardexCore.IDS.length ? score : (1 - score) / (CardexCore.IDS.length - 1)];
            })),
          },
    };
  });
  const activeRecords = () =>
    state.mode === "example" ? examples : state.sessions;
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
        .sort((a, b) => b.recordDate.localeCompare(a.recordDate));
    },
    async list() {
      return activeRecords()
        .slice()
        .sort((a, b) => b.recordDate.localeCompare(a.recordDate));
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
  const navigationIcons = {
    history: '<rect x="3" y="3" width="18" height="4" rx="1"/><path d="M5 7v13h14V7M10 11h4"/>',
    settings: '<path d="m9.5 3-.5 2a8 8 0 0 0-1.5.9l-2-.6-2.5 4.4L5 11v2l-2 1.3 2.5 4.4 2-.6A8 8 0 0 0 9 19l.5 2h5l.5-2a8 8 0 0 0 1.5-.9l2 .6 2.5-4.4L19 13v-2l2-1.3-2.5-4.4-2 .6A8 8 0 0 0 15 5l-.5-2Z"/><circle cx="12" cy="12" r="3"/>',
  };
  const navigationButton = (action, label) => btn(action,
    `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${navigationIcons[action]}</svg>`,
    "icon", `aria-label="${label}" title="${label}"`);
  const more = (id, contents) => `<button type="button" class="quiet more-trigger" popovertarget="${id}">더보기</button><div id="${id}" class="action-popover" popover>${contents}</div>`;
  function currentRecord() {
    return activeRecords().find((r) => r.id === state.selected);
  }
  const emptyHint = (typing) => typing ? "지금의 마음을 글로 남겨 보세요" : "짧은 한 문장부터 시작해 보세요";
  function emptyCard() {
    const typing = Boolean(String(state.text || "").trim());
    return `<div class="empty-card" data-typing="${typing}" role="img" aria-label="아직 열리지 않은 오늘의 카드"><div class="empty-top"><span class="empty-meta">오늘의 모먼트</span><span class="empty-meta">${E(state.date)}</span></div><div class="empty-art" aria-hidden="true"><span class="empty-spark s1">✦</span><span class="empty-spark s2">✧</span><span class="empty-spark s3">✦</span><img class="empty-silhouette" src="${objectAssets.heart}" alt=""></div><span class="empty-dots" aria-hidden="true">○ ○ ○</span><div class="empty-bottom"><h2>오늘의 기록을<br>기다리고 있어요</h2><p class="empty-hint">${emptyHint(typing)}</p></div></div>`;
  }
  // Shared artwork for cards, archive thumbnails, catalog and PNG export.
  function characterSVG(type, attrs = "") {
    const emotion = CardexCore.type(type);
    const css = getComputedStyle(document.documentElement);
    const ink = css.getPropertyValue('--ink').trim();
    const surface = css.getPropertyValue('--surface').trim();
    const question = '<path d="M8 8a4 4 0 0 1 8 0c0 3-4 3-4 6"/><circle cx="12" cy="19" r="1" fill="currentColor" stroke="none"/>';
    const exclamation = '<path d="M12 4v10"/><circle cx="12" cy="19" r="1" fill="currentColor" stroke="none"/>';
    const marks = {
      neu_1: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
      neu_2: question,
      neu_3: exclamation,
      neu_4: '<g transform="translate(-2 3) scale(.8)">' + question + '</g><g transform="translate(9 3) scale(.8)">' + exclamation + '</g>',
    };
    const mark = marks[type];
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" data-character="${emotion.id}" ${attrs} aria-hidden="true" focusable="false"><image href="${objectAssets[emotion.asset || emotion.id]}" width="100" height="100" preserveAspectRatio="xMidYMid meet"/>${mark ? `<g data-emotion-mark="${type}"><circle cx="82" cy="82" r="17" fill="${surface}" stroke="${ink}" stroke-width="1"/><g transform="translate(70 70)" fill="none" stroke="${ink}" color="${ink}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${mark}</g></g>` : ""}</svg>`;
  }
  function cardSVG() {
    const record = currentRecord(), card = DiaryCards.resolve(record);
    const name = card.status === "ready" ? CardexCore.type(card.type).name
      : card.status === "blank" ? "빈 카드" : card.status === "error" ? "분석 실패" : recordStorageLabel();
    const css = getComputedStyle(document.documentElement);
    const token = n => css.getPropertyValue(n).trim();
    const artwork = card.status === "ready"
      ? characterSVG(card.type, 'x="170" y="360" width="740" height="760"')
      : `<rect x="180" y="480" width="720" height="480" rx="80" fill="${token('--surface')}"/><text x="540" y="730" text-anchor="middle" font-size="42">${E(card.status === "pending" ? "기록을 다시 읽어 보세요" : name)}</text>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1620" viewBox="0 0 1080 1620" role="img" aria-label="${E(name)} 감정 카드" class="art-card">
      <rect width="1080" height="1620" rx="40" fill="${token('--paper')}"/>
      <rect x="38" y="38" width="1004" height="1544" rx="30" fill="${token('--stage')}" stroke="${token('--line')}"/>
      <g fill="${token('--ink')}" font-family="IBM Plex Sans KR,sans-serif">
      <text x="90" y="150" font-size="38">${E(record?.recordDate || state.date)} · ${E(timeLabel(record?.createdAt))}</text>
      ${card.status === "ready" ? `<rect x="90" y="184" width="138" height="52" rx="16" fill="${token('--surface')}"/><text x="159" y="222" text-anchor="middle" font-size="32">${E(CardexCore.parent(CardexCore.type(card.type).parent).name)}</text>` : ""}
      <text x="90" y="320" font-size="68" font-weight="600">${E(name)}</text>
      ${artwork}
      ${card.status === "ready" ? `<rect x="90" y="1150" width="210" height="74" rx="24" fill="${token('--surface')}"/><text x="195" y="1200" text-anchor="middle" font-size="40">${card.stage}단계</text><text x="90" y="1310" font-size="42">분류 확률 ${Math.round(card.score * 100)}%${card.ties.length > 1 ? ' · 공동 최다' : ''}</text><text x="90" y="1380" font-size="36">감정의 강도를 뜻하지 않아요</text>` : `<text x="90" y="1300" font-size="38">${card.status === "pending" ? '감정 분석은 준비 중이에요' : card.status === "blank" ? '뚜렷한 대표 감정이 없는 기록이에요' : '기록은 그대로 읽을 수 있어요'}</text>`}
      <path d="M90 1440h900" stroke="${token('--line')}"/>
      <text x="90" y="1510" font-size="32">오늘의 모먼트 · ${state.mode === 'example' ? '예시 · 실제 입력 분석 아님' : '나의 기록'}</text></g></svg>`;
  }

  function recordStorageLabel() {
    if (state.mode === "example") return "예시 기록";
    if (lastStorageError || !storeReady) return "기록을 보관하지 못했어요";
    return generation === savedGeneration ? "기록을 보관했어요" : "기록을 보관 중이에요";
  }

  function cardArea() {
    const record=currentRecord(), card=DiaryCards.resolve(record);
    const inner=record ? `<div class="flip-scene"><div class="tilt-layer"><div class="flip-inner"><div class="flip-front"><button class="flip-trigger" data-flip="back" type="button" aria-label="카드를 뒤집어 기록 보기">${cardSVG()}<span class="flip-light" aria-hidden="true"></span></button></div><div class="flip-back" role="button" tabindex="-1" aria-label="카드 앞면으로 돌아가기. Enter 또는 스페이스를 누르세요." aria-hidden="true" inert><span class="flip-light" aria-hidden="true"></span><p class="muted">${E(record.recordDate)}</p><h2>그날의 기록</h2><div class="flip-text" tabindex="0">${E(record.text)}</div><small class="muted">탭하면 카드 앞면 · 본문 밖을 터치·드래그하면 빛과 기울기</small></div></div></div></div>` : emptyCard();
    return `<section class="card-area"><div class="card-box">${inner}</div><p class="caption muted">${record ? recordStorageLabel() + " · 탭해서 뒤집기" : "기록은 보관할 수 있어요."}<br>${state.mode === "example" ? "예시 모드 · 실제 입력 분석 아님" : "실제 분석은 준비 중이에요."}</p><div class="card-actions">${record && state.mode === "real" && (lastStorageError || !storeReady) ? btn("retry-save","저장 재시도") : ""}${record ? btn("read-full","기록 읽기","primary") : ""}${["ready","blank"].includes(card.status) ? btn("download","이미지 저장","quiet",state.busy?"disabled":"") : ""}${record ? more("card-more", (state.view === "entry" ? btn("edit-example","수정하기") : "") + (card.status === "ready" ? btn("card-catalog","캐릭터 도감") : "") + btn("delete-example","삭제","quiet danger")) : ""}</div></section>`;
  }


  /*__STATISTICS_VIEW__*/
  function panel() {
    if (state.view === "settings")
      return `<section class="panel settings-panel"><div class="row"><h2>설정</h2></div><div class="panel-body"><fieldset><legend>화면 테마</legend><div class="theme-grid">${CardexTheme.themes.map(t=>`<label class="theme-option"><input type="radio" name="appearance" value="${t.id}" ${CardexTheme.getTheme()===t.id?"checked":""}><div class="theme-preview" data-appearance="${t.id}" data-theme="${CardexTheme.getResolvedMode()}" aria-hidden="true">오늘의 모먼트<span></span></div><strong>${t.name}</strong><small>${t.description}</small></label>`).join("")}</div></fieldset><fieldset><legend>화면 모드</legend><div class="mode-options">${[["light","밝음"],["dark","어두움"],["system","시스템"]].map(([v,n])=>`<label><input type="radio" name="color-mode" value="${v}" ${CardexTheme.getPreference()===v?"checked":""}>${n}</label>`).join("")}</div></fieldset><fieldset><legend>카드 효과</legend><button type="button" class="quiet" data-card-motion-toggle aria-pressed="${CardexTheme.getMotion()==="on"}" aria-describedby="card-motion-help">카드 효과 ${CardexTheme.getMotion()==="on"?"켜짐":"꺼짐"}</button><p class="muted" id="card-motion-help">버튼을 누르면 카드 효과를 켜거나 꺼요. 켜면 기기의 움직임 줄이기 설정과 관계없이 빛·기울임·뒤집기 효과를 사용해요. 모바일에서는 본문 밖을 터치하고 움직여 보세요.</p></fieldset><p class="muted">디자인 선택을 이 브라우저에 보관해요.</p><details><summary>기록 방식</summary><p class="muted">기록 방식도 이 브라우저에 보관해요.</p>${[
        ["single", "하루 한 편", "오늘의 기록을 이어서 수정해요."],
        ["multi", "하루 여러 편", "순간마다 새로운 기록을 남겨요."],
      ]
        .map(
          ([v, t, d]) =>
            `<label class="settings-option"><input type="radio" name="policy" value="${v}" ${state.policy === v ? "checked" : ""}><span>${t}<br><small class="muted">${d}</small></span></label>`,
        )
        .join(
          "",
        )}</details><details><summary>데이터 관리</summary><p class="muted">기록은 이 브라우저에만 보관돼요. 계정·동기화·서버 백업은 제공하지 않아요.${btn("delete-all",state.clearAllConfirm ? "정말 모든 기록 삭제" : "이 브라우저의 기록 전체 삭제","quiet danger")}</p></details><details><summary>예시 모드</summary><label><input type="checkbox" role="switch" data-action="preview" ${state.mode === "example" ? "checked" : ""}>예시 모드 둘러보기</label></details></div></section>`;
    if (state.view === "history") return archivePanel();
    const x = activeRecords().find((x) => x.id === state.selected);
    if (!x) {
      state.view = "history";
      return panel();
    }
    return `<section class="panel record-panel"><div class="row"><h2>${x.recordDate}</h2>${btn("history", "목록으로")}</div><div class="record-layout show-record-card ${state.editing ? "is-editing" : ""}"><div class="record-copy" ${state.editing ? "" : "hidden"}>${state.editing ? `<label for="sample-text">기록 수정</label><textarea class="read-text" id="sample-text">${E(x.text)}</textarea>` : `<div class="read-text">${E(x.text)}</div>`}<div class="row">${state.editing ? btn("save-example", "수정 완료", "primary") + btn("cancel-edit", "취소") : ""}</div></div>${cardArea()}</div></section>`;
  }

  function render(focus = false) {
    const old = document.activeElement?.dataset.action;
    app.innerHTML = `<div class="shell"><header><button type="button" data-action="write" class="brand" aria-label="오늘의 모먼트 · 작성 화면으로">✦ 오늘의 모먼트 <small>작은 하루, 나만의 페이지</small></button><div class="icons">${navigationButton("history", "보관함")}${navigationButton("settings", "설정")}</div></header><main id="main-content" class="workspace ${state.view === "card" ? "show-card" : ""}">${["write", "card"].includes(state.view) ? `<section class="editor"><div class="editor-content"><div class="row"><span class="muted">${state.date}</span><span class="muted">${state.policy === "single" ? "하루 한 편" : "하루 여러 편"}</span></div><h1>오늘은 어떤 하루였나요?</h1><label for="diary-text" class="sr-only">오늘의 기록</label><textarea id="diary-text" placeholder="마음에 남은 순간을 적어 보세요." aria-describedby="privacy save-status feedback">${E(state.text)}</textarea><div class="storage-row"><span id="save-status" role="status">${E(storageMessage)}</span>${btn("retry-save","저장 재시도","quiet",lastStorageError || !storeReady ? "" : "hidden")}${more("draft-more",btn("clear-draft","초안 지우기"))}</div><div class="privacy-row"><p id="privacy">이 브라우저에만 보관돼요.</p><details><summary>보관 안내</summary><p>다른 기기와 동기화되지 않으며 브라우저 데이터 삭제 시 기록도 사라져요. 공용 기기에서는 사용 후 삭제해 주세요.</p></details></div></div>${btn(state.policy === "multi" && state.savedText === state.text ? "new-entry" : "save", state.policy === "multi" && state.savedText === state.text ? "새 기록 쓰기" : "기록 남기기", "primary")}</section>${cardArea()}` : panel()}</main><dialog id="confirm-dialog" class="read-dialog" aria-labelledby="confirm-title"><h2 id="confirm-title">삭제 확인</h2><p id="confirm-copy"></p><div class="row"><button type="button" class="quiet" data-confirm="cancel" autofocus>취소</button><button type="button" class="primary" data-confirm="accept">삭제</button></div></dialog><dialog id="read-full-dialog" class="read-dialog" aria-labelledby="full-title"><div class="full-heading"><div><p class="full-date muted"></p><h2 id="full-title">그날의 기록</h2></div><form method="dialog"><button type="submit" class="quiet">닫기</button></form></div><div class="full-text" tabindex="0"></div></dialog><div><p id="feedback" class="status ${state.error ? "error" : ""}" role="${state.error ? "alert" : "status"}">${E(state.status)}</p><footer><span>EVERY DAY IS A LITTLE ART.</span><span>나만의 속도로 기록해요 ✧</span></footer></div></div>`;
    app.querySelectorAll("[popover]").forEach(el => el.addEventListener("toggle", e => { if (e.newState === "closed") app.querySelector(`[popovertarget="${el.id}"]`)?.focus(); }));
    app
      .querySelectorAll("[data-action]")
      .forEach((b) => (b.onclick = () => action(b.dataset.action)));
    app.querySelectorAll("[data-open]").forEach(
      (b) =>
        (b.onclick = () => {
          state.selected = b.dataset.open;
          state.recordTab = "card";
          state.view = "entry";
          state.editing = false;
          state.deleteConfirm = false;
          render(true);
        }),
    );
    DiaryFlip.bind(app);
    app.querySelector("#diary-text")?.addEventListener("input", (e) => {
      state.text = e.target.value;
      state.clearDraftConfirm = false;
      schedulePersist();
      const button = app.querySelector(".editor .primary");
      const saved = state.policy === "multi" && state.savedText === state.text;
      button.dataset.action = saved ? "new-entry" : "save";
      button.textContent = saved ? "새 기록 쓰기" : "기록 남기기";
      const empty = app.querySelector(".empty-card");
      if (empty) {
        const typing = Boolean(String(state.text || "").trim());
        if (empty.dataset.typing !== String(typing)) {
          empty.dataset.typing = String(typing);
          empty.querySelector(".empty-hint").textContent = emptyHint(typing);
        }
      }
    });
    app.querySelectorAll("[name=policy]").forEach(
      (x) =>
        (x.onchange = () => {
          state.policy = x.value;
          state.currentEntryId = null;
          state.status = "기록 방식을 바꿨어요. 기존 기록은 유지돼요.";
          markChanged();
          void persist();
          render();
        }),
    );
    bindStatistics();
    bindCatalog();
    if (loading) app.querySelectorAll("button,textarea,input,select").forEach(el => el.disabled = true);
    if (focus) {
      const target = app.querySelector("h1,h2");
      target?.setAttribute("tabindex", "-1");
      target?.focus();
    } else if (old)
      app
        .querySelector(`[data-action="${old}"]`)
        ?.focus({ preventScroll: true });
  }
  async function action(a) {
    if (loading) return;
    let opener = document.activeElement;
    const popover = opener?.closest('[popover]');
    if (popover) { opener = app.querySelector(`[popovertarget="${popover.id}"]`); popover.hidePopover(); opener?.focus(); }
    if (["delete-example", "clear-draft", "delete-all"].includes(a)) {
      const accepted = await new Promise(resolve => {
        const dlg = app.querySelector('#confirm-dialog');
        dlg.querySelector('#confirm-copy').textContent = a === 'delete-all' ? '실제 기록 전체와 초안을 삭제합니다. 표시 설정과 예시 기록은 유지됩니다.' : a === 'clear-draft' ? '초안만 지웁니다. 저장된 기록은 유지됩니다.' : '이 기록을 삭제합니다. 통계와 도감에도 반영됩니다.';
        dlg.returnValue = "cancel";
        dlg.querySelector('[data-confirm=cancel]').onclick = () => dlg.close('cancel');
        dlg.querySelector('[data-confirm=accept]').onclick = () => dlg.close('accept');
        dlg.addEventListener('close', () => { opener?.focus(); resolve(dlg.returnValue === 'accept'); }, {once:true});
        dlg.showModal();
      });
      if (!accepted) return;
      if (a === 'delete-example') state.deleteConfirm = true;
      if (a === 'clear-draft') state.clearDraftConfirm = true;
      if (a === 'delete-all') state.clearAllConfirm = true;
    }
    if (a === 'cancel-edit') { state.editing = false; render(true); return; }
    state.error = false;
    state.status = "";
    if (a !== "delete-all") state.clearAllConfirm = false;
    if (a !== "clear-draft") state.clearDraftConfirm = false;
    if (a === "read-full") {
      const r = currentRecord(); if (!r) return;
      const dlg = app.querySelector("#read-full-dialog"), opener = app.querySelector('[data-action="read-full"]');
      dlg.querySelector(".full-date").textContent = r.recordDate;
      dlg.querySelector(".full-text").textContent = r.text;
      dlg.addEventListener("close", () => opener?.focus(), { once: true });
      dlg.showModal(); return;
    }
    if (a === "retry-save") { if (!storeReady) { await restore(); return; } await persist(); render(); return; }
    if (a === "clear-draft" || a === "delete-all") {
      const key = a === "clear-draft" ? "clearDraftConfirm" : "clearAllConfirm";
      if (!state[key]) { state[key] = true; state.status = a === "clear-draft" ? "한 번 더 누르면 초안을 지워요." : "한 번 더 누르면 모든 실제 기록과 초안을 지워요."; render(); return; }
      state.text = ""; state.savedText = null; state.currentEntryId = null; state[key] = false;
      if (a === "delete-all") { state.sessions = []; state.selected = null; }
      markChanged(); await persist(); render(); return;
    }
    if (a === "archive-records") { state.archiveTab = "records"; state.dateFilter = ""; state.cardFilter = null; state.view = "history"; render(true); return; }
    if (["write", "settings", "history"].includes(a)) {
      state.view = a;
      state.deleteConfirm = false;
      if (a === "write") state.date = localDate();
      render(true);
      return;
    }
    if (a === "new-entry") {
      state.text = "";
      state.savedText = null;
      state.currentEntryId = null;
      state.date = localDate();
      state.view = "write";
    }
    if (a === "preview") {
      state.mode = state.mode === "real" ? "example" : "real";
      state.selected =
        activeRecords().find((r) => DiaryCards.resolve(r).status === "ready")
          ?.id || null;
      state.view = "history";
      state.archiveTab = "records";
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
        await repository.remove(state.selected);
        if (state.mode === "real" && state.currentEntryId === state.selected) { state.currentEntryId = null; state.savedText = null; }
        state.view = "history";
        state.deleteConfirm = false;
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
          id: previous?.id || crypto.randomUUID(),
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
        state.view = "card";
      } catch (e) {
        state.error = true;
        state.status = e.message;
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
        const svg = cardSVG();
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
        canvas.width = 1080;
        canvas.height = 1620;
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
        state.status = "예시 이미지 다운로드를 요청했어요.";
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
      if (await persist()) state.status = "기록을 저장했어요. 감정 분석은 준비 중이에요.";
    }
    render();
  }
  function size() {
    document.documentElement.style.setProperty(
      "--app-height",
      (window.visualViewport?.height || innerHeight) + "px",
    );
  }
  size();
  window.visualViewport?.addEventListener("resize", size);
  let timer;
  window.addEventListener("resize", () => {
    size();
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (state.view === "history" && !app.querySelector("dialog[open]")) render();
    }, 120);
  });
  window.addEventListener("focus", () => {
    if (state.view === "write" && state.date !== localDate()) {
      state.date = localDate();
      render();
    }
  });
  window.addEventListener("hashchange", () =>
    history.replaceState(null, "", location.pathname + location.search),
  );
  if (location.hash)
    history.replaceState(null, "", location.pathname + location.search);
  window.addEventListener("cardex-theme-change",()=>{
    CardexTheme.sync();
    app.querySelectorAll(".theme-preview").forEach(el=>el.dataset.theme=CardexTheme.getResolvedMode());
    app.querySelectorAll(".art-card").forEach(el=>el.outerHTML=cardSVG());
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

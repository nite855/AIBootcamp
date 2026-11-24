// Home and archive share the same record rows and ordering.
function recordRow(record) {
  const card = DiaryCards.resolve(record);
  return `<button type="button" class="entry" data-open="${E(record.id)}"><span class="mini-art"${gradeAttrs(card)} aria-hidden="true">${miniCard(record)}</span><span class="entry-meta"><strong class="entry-preview">${E(record.text.split("\n")[0])}</strong><small>${E(record.recordDate)} · ${E(timeLabel(record.createdAt))}</small><span class="entry-state">${record.favorite ? "★ 즐겨찾기 · " : ""}${E(cardLabel(record))}</span></span><span aria-hidden="true" class="entry-arrow">›</span></button>`;
}
// Live counter shown under the editor; hidden from the live region to avoid per-keystroke announcements.
function charCountText(text) {
  const s = DiaryCore.lengthState(text), n = s.count.toLocaleString("ko-KR"), max = s.limit.toLocaleString("ko-KR");
  if (s.level === "over") return { level: s.level, label: `${n} / ${max}자 · ${(s.count - s.limit).toLocaleString("ko-KR")}자 초과` };
  if (s.level === "warn") return { level: s.level, label: `${n} / ${max}자 · 곧 한도예요` };
  return { level: s.level, label: `${n} / ${max}자` };
}
function charCount() {
  const c = charCountText(state.text);
  return `<span id="char-count" class="char-count" data-level="${c.level}">${E(c.label)}</span>`;
}
// Warns from 25 real records so the 30-record limit never arrives as a save error first.
function limitNotice() {
  const s = DiaryCore.recordLimitState(state.mode === "real" ? state.sessions.length : 0);
  if (s.level === "full") return `<p id="privacy" class="privacy-note limit-note" data-level="full">보관 한도 30편에 도달했어요. 새 기록은 정리한 뒤에 남길 수 있어요. ${btn("archive-records", "지난 기록 정리하기")}</p>`;
  if (s.level === "near") return `<p id="privacy" class="privacy-note limit-note" data-level="near">이 브라우저에만 보관돼요 · <strong>${s.remaining}편 남았어요</strong> (최대 30편)</p>`;
  // The data-loss warning used to live only in the "⋯" menu (2026-11-24); it now shows on every width.
  return `<p id="privacy" class="muted privacy-note">이 브라우저에만 보관돼요 · 브라우저 데이터를 지우면 함께 사라져요 · 최대 30편</p>`;
}
// Shown until the first record exists (Figma "기록 · 첫 실행"): replaces today's card and the
// calendar with "카드는 이렇게 모여요". Step 3 states the real rule (stages come from the
// classification probability), not the design's count-based wording.
function firstRunGuide() {
  const steps = [
    ["하루를 기록해요", "짧아도 괜찮아요. 하루 한 편만 남길 수 있어요."],
    ["감정을 읽어요", "감정 분석 모델이 기록에서 가장 가까운 감정 하나를 찾아요. 지금은 분석 준비 중이에요."],
    ["카드를 모아요", "분석된 감정이 카드가 되어 도감에 모여요. 분류 확률은 감정의 강도가 아니에요."],
  ];
  return `<section class="panel how-panel" aria-labelledby="how-title"><div class="how-stage" aria-hidden="true"><span class="stage-glow"></span>${lockedMiniCard("첫 번째 카드")}</div><h2 id="how-title">카드는 이렇게 모여요</h2><ol class="first-run how-steps">${steps.map(([t, d], i) => `<li><b aria-hidden="true">${i + 1}</b><span><strong>${t}</strong><small>${d}</small></span></li>`).join("")}</ol></section>`;
}
// "오후 9:12" for the saved line under today's heading.
const savedClock = value => value ? new Date(value).toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" }) : "";
// Real first run: no records yet (never in example mode or while loading).
function isFirstRun() { return state.mode === "real" && !loading && state.sessions.length === 0; }
// Today's record is saved and the editor still holds exactly that text (Figma "오늘 작성 완료").
function todayDone() {
  const record = state.date === localDate() ? dayRecord(state.date) : null;
  return record && String(state.text || "").trim() === String(record.text || "").trim() ? record : null;
}
function doneMessage(record) {
  const card = DiaryCards.resolve(record);
  if (card.status === "ready") return `${CardexCore.type(card.type).name} · ${card.stage}단계 카드를 받았어요`;
  if (card.status === "blank") return "빈 카드를 받았어요";
  if (card.status === "error") return "기록은 저장됐어요 · 분석하지 못했어요";
  return "기록을 저장했어요 · 카드는 분석 대기 중이에요";
}
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const monthTitle = month => `${month.slice(0, 4)}년 ${Number(month.slice(5, 7))}월`;
const SNIPPET_LIMIT = 24;
const shortDate = date => `${Number(date.slice(5, 7))}월 ${Number(date.slice(8))}일`;
function weekTitle(start) {
  const end = DiaryStatistics.addDays(start, 6);
  return `${shortDate(start)} ~ ${start.slice(5, 7) === end.slice(5, 7) ? Number(end.slice(8)) + "일" : shortDate(end)}`;
}
// Keeps the week view inside the month the user just moved to (this week for the current month).
function syncCalendarWeek(month) {
  const today = localDate();
  state.calendarWeek = DiaryStatistics.weekStart(month === today.slice(0, 7) ? today : month + "-01");
}
// Round previous/next button with an SVG chevron, so the mark sits in the exact centre
// (text glyphs like ‹ › sit on the font baseline and drift low).
function navArrow(dir, attrs, label, disabled = false) {
  return `<button type="button" class="nav-arrow" data-dir="${dir < 0 ? "prev" : "next"}" ${attrs} aria-label="${label}" ${disabled ? "disabled" : ""}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5.5 8.5 12l6.5 6.5"/></svg></button>`;
}
// ── Soft UI v1.1 record screen (Figma "기록 · 입력됨", "월간 달력", "카드 모달") ──
const weekdayName = date => WEEKDAYS[new Date(date + "T12:00:00").getDay()] + "요일";
const longDate = date => `${shortDate(date)} ${weekdayName(date)}`;
// The day's latest record (real records are one per day; the example set has two on some days).
// Reads activeRecords() directly so an archive card filter never hides a calendar day.
function dayRecord(date) {
  return activeRecords().filter(r => r.recordDate === date).sort(compareRecords)[0] || null;
}
// Dates that have a record, oldest first (the card modal steps through these).
function recordDays() {
  return [...new Set(activeRecords().map(r => r.recordDate))].sort();
}
// Save button label by what the save does (2026-11-24): a new record, an edit of today's record, or a
// draft that replaces today's record (one per day). ".save-long" is hidden on phones.
// A new record reads "기록 남기기" until the emotion model is connected (2026-11-24 critique): "카드 받기"
// promised a card that every real save answers with an "분석 대기" card.
const SAVE_LABELS = {
  new: '기록 남기기',
  edit: '<span class="save-long">수정한 내용 </span>저장하기',
  replace: '<span class="save-long">오늘 </span>기록 바꾸기',
};
const saveLabel = () => SAVE_LABELS[saveKind()];
// One calendar slot: the day's mini card (opens the card modal) or an empty frame.
// Today has an ink outline; days after today are dashed and never clickable.
function dayCard(date, today) {
  const record = dayRecord(date), isToday = date === today, future = date > today;
  const label = `${longDate(date)}${isToday ? ", 오늘" : ""}, ${record ? cardLabel(record) + ", " + firstLine(record.text, SNIPPET_LIMIT) : future ? "아직 오지 않은 날" : "기록 없음"}`;
  const cls = `day-card${isToday ? " is-today" : ""}${future ? " is-future" : ""}${record ? " has-record" : ""}`;
  const current = isToday ? ' aria-current="date"' : "";
  return record
    ? `<button type="button" class="${cls}" data-card-day="${date}" aria-label="${E(label)}"${current}>${miniCard(record)}</button>`
    : `<span class="${cls}" role="img" aria-label="${E(label)}"${current}><span class="day-slot"></span></span>`;
}
// 주간: seven mini cards, Sunday to Saturday.
function weekRail() {
  const today = localDate();
  // Figma: weekday on top (no red Sunday), the date number under each card (bold today, faint future).
  return `<ol class="week-rail" aria-label="${E(weekTitle(state.calendarWeek))}">${DiaryStatistics.weekDates(state.calendarWeek).map((date, i) => `<li><span class="rail-day" aria-hidden="true">${WEEKDAYS[i]}</span>${dayCard(date, today)}<span class="rail-date${date === today ? " is-today" : date > today ? " is-future" : ""}" aria-hidden="true">${Number(date.slice(8))}</span></li>`).join("")}</ol>`;
}
// 월간: the whole month as mini cards; the row below opens the latest recorded day of the month.
function monthCards(month) {
  const today = localDate(), first = new Date(month + "-01T12:00:00").getDay();
  const total = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
  const cells = Array.from({ length: total }, (_, i) => {
    const date = `${month}-${String(i + 1).padStart(2, "0")}`;
    return `<div class="month-cell">${dayCard(date, today)}<span class="cell-date${date === today ? " is-today" : date > today ? " is-future" : ""}" aria-hidden="true">${i + 1}</span></div>`;
  });
  // Selected preview (Figma "selected-preview"): the chosen recorded day, otherwise today in the
  // current month (with an invitation when today is still empty), otherwise the latest recorded day.
  const days = recordDays().filter(d => d.startsWith(month));
  const pick = days.includes(state.calendarDay) ? state.calendarDay : month === today.slice(0, 7) ? today : days[days.length - 1];
  const record = pick ? dayRecord(pick) : null;
  const summary = record
    ? `<button type="button" class="month-summary-row" data-card-day="${pick}"><span class="summary-thumb" aria-hidden="true">${miniCard(record)}</span><span class="summary-copy"><strong>${E(longDate(pick))}${pick === today ? " · 오늘" : ""}</strong><small>${E(cardLabel(record))} · ${E(firstLine(record.text, SNIPPET_LIMIT))}</small></span><span class="entry-arrow" aria-hidden="true">›</span></button>`
    : pick
      ? `<p class="month-summary-row is-empty"><span class="summary-thumb" aria-hidden="true">${lockedMiniCard("오늘의 카드")}</span><span class="summary-copy"><strong>${E(longDate(pick))} · 오늘</strong><small>기록을 남기면 오늘의 카드가 열려요</small></span></p>`
      : `<p class="month-summary-row is-empty muted">이 달에는 아직 기록이 없어요.</p>`;
  return `<div class="month-cards" aria-label="${E(monthTitle(month))} 카드 달력">${WEEKDAYS.map(d => `<span class="weekday" aria-hidden="true">${d}</span>`).join("")}${'<span class="month-cell is-pad" aria-hidden="true"></span>'.repeat(first)}${cells.join("")}</div><p class="month-hint">카드를 누르면 그날 기록이 열려요</p>${summary}`;
}
function writeCalendar() {
  const monthView = state.writeCalendar === "month", today = localDate(), thisMonth = today.slice(0, 7);
  const month = state.homeMonth || thisMonth;
  const streak = DiaryStatistics.streakDays(activeRecords().map(r => r.recordDate), today);
  const label = DiaryStatistics.weekLabel(state.calendarWeek);
  const nav = monthView
    ? `${navArrow(-1, 'data-home-month="-1"', "이전 달")}<h2 class="calendar-title">${monthTitle(month)}</h2>${navArrow(1, 'data-home-month="1"', "다음 달", month >= thisMonth)}`
    : `${navArrow(-1, 'data-week-step="-1"', "이전 주")}<h2 class="calendar-title">${label.month}월 ${label.week}주<span class="sr-only"> (${E(weekTitle(state.calendarWeek))})</span></h2>${navArrow(1, 'data-week-step="1"', "다음 주", state.calendarWeek >= DiaryStatistics.weekStart(today))}`;
  const toggle = `<div class="calendar-switch" role="group" aria-label="달력 보기">${[["week", "주간"], ["month", "월간"]].map(([id, text]) => `<button type="button" data-write-calendar="${id}" aria-pressed="${(state.writeCalendar || "week") === id}">${text}</button>`).join("")}</div>`;
  const monthCount = activeRecords().filter(r => r.recordDate.startsWith(month)).length;
  return `<section class="panel write-calendar" aria-label="나의 카드 달력">${monthView ? `<p class="month-count">${monthTitle(month)} · 기록 ${monthCount}편</p>` : ""}<div class="calendar-head"><div class="calendar-nav">${nav}</div>${streak ? `<span class="streak-chip">${streak}일 연속</span>` : ""}${toggle}</div>${monthView ? monthCards(month) : weekRail()}</section>`;
}
// Today's card: the saved record's mini card, or a fan of locked cards until today is written.
// Figma "today-card" (480×508): a glow, two fanned pastel cards and today's card in the middle,
// with a two-line caption. Once today is written the real card stands alone ("내일 또 만나요").
function todayPanel() {
  const today = localDate(), record = dayRecord(today);
  if (record) {
    const card = DiaryCards.resolve(record);
    const copy = card.status === "pending" ? "감정 분석이 끝나면 카드가 열려요" : "내일 또 만나요";
    return `<section class="panel today-panel has-card" aria-labelledby="today-title"><div class="today-stage"><span class="stage-glow" aria-hidden="true"></span><button type="button" class="today-card" data-card-day="${today}" aria-label="오늘의 카드 열기, ${E(cardLabel(record))}"${gradeAttrs(card)}>${cardSVG(record)}</button></div><div class="today-copy"><h2 id="today-title">오늘의 카드</h2><p class="muted today-hint">${copy}</p></div></section>`;
  }
  const failed = state.mode === "real" && !loading && Boolean(lastStorageError || !storeReady);
  return `<section class="panel today-panel" aria-labelledby="today-title"><div class="today-stage card-fan" aria-hidden="true"><span class="stage-glow"></span><span class="fan-card f1"></span><span class="fan-card f2"></span><span class="fan-center">${lockedMiniCard("오늘의 카드")}</span></div><div class="today-copy"><h2 id="today-title">오늘의 카드</h2><p class="muted today-hint">${failed ? "저장되면 카드가 열려요" : "기록을 남기면 카드가 열려요"}</p></div></section>`;
}
// Recent record tile: emotion-colored orb, first line, "11.17 · 기쁨·활력 · 2단계". Opens the record page.
function recentTile(record) {
  const card = DiaryCards.resolve(record), ready = card.status === "ready";
  const meta = `${record.recordDate.slice(5).replace("-", ".")} · ${ready ? CardexCore.type(card.type).name + " · " + card.stage + "단계" : cardLabel(record)}${record.favorite ? " · ★" : ""}`;
  return `<button type="button" class="entry recent-tile" data-open="${E(record.id)}"${gradeAttrs(card)}><span class="tile-orb" aria-hidden="true"${ready ? ` style="--orb:var(--card-base-${card.type.replace("_", "-")});--orb-deep:var(--card-deep-${card.type.replace("_", "-")})"` : ""}></span><strong class="entry-preview">${E(firstLine(record.text, 40))}</strong><small>${E(meta)}</small></button>`;
}
function homeView() {
  const recent = activeRecords().slice().sort(compareRecords).slice(0, 2);
  const failed = Boolean(!loading && (lastStorageError || !storeReady));
  const example = state.mode === "example" ? '<span class="chip example-badge">예시 모드</span>' : "";
  const first = isFirstRun(), done = !failed && todayDone();
  // Figma headings: first run, today written, or the default question (line break as designed).
  const heading = first ? "처음 오셨네요,<br>오늘 마음을 적어볼까요?" : done ? "오늘의 기록을<br>남겼어요" : "오늘은 어떤<br>하루였나요?";
  // The grid theme highlights the date and adds a diary page label ("p. <day of year> · <year> diary").
  const [year, month, day] = state.date.split("-").map(Number);
  const page = Math.round((Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 0)) / 864e5);
  const dateLine = `<span class="page-day">${E(longDate(state.date))}</span>${done ? ` · ${E(savedClock(done.updatedAt || done.createdAt))} 저장` : ""}<span class="diary-page" aria-hidden="true">p. ${page} · ${year} diary</span>`;
  const empty = !String(state.text || "").trim();
  const options = more("draft-more", btn("help-write", "무엇을 쓸까요?", "quiet", 'aria-haspopup="dialog"') + btn("clear-draft", "초안 지우기") + '<p class="menu-note">기록은 다른 기기와 동기화되지 않아요. 브라우저 데이터를 삭제하면 기록도 사라져요.</p>', '<span aria-hidden="true">⋯</span><span class="sr-only">작성 옵션</span>');
  // Today written: the bar reports the card and offers 수정하기 / 카드 보기 (typing switches back to save).
  const doneCard = done ? DiaryCards.resolve(done) : null;
  const doneBar = done ? `<p class="done-status"><span class="done-dot" aria-hidden="true"${doneCard.status === "ready" ? ` style="--dot:var(--card-base-${doneCard.type.replace("_", "-")})"` : ""}></span>${E(doneMessage(done))}</p><div class="done-actions"><button type="button" class="secondary" data-write-edit>수정하기</button><button type="button" class="primary" data-open="${E(done.id)}">카드 보기</button></div>` : "";
  return `<section class="write-main" aria-labelledby="write-title">
    <div class="page-heading write-heading${first ? " is-first" : ""}"><p class="page-date">${dateLine}${example}</p><h1 id="write-title">${heading}</h1></div>
    <div class="panel write-panel write-editor" data-storage-error="${failed}" data-done="${Boolean(done)}" data-empty="${empty}"${state.writeError ? " data-write-error" : ""}>
      <label for="diary-text" class="sr-only">오늘의 기록</label><textarea id="diary-text" placeholder="오늘 있었던 일, 떠오른 생각, 사소한 기분까지&#10;편하게 적어 주세요. 하루 한 편이면 충분해요." aria-describedby="char-count privacy save-status feedback">${E(state.text)}</textarea>
      <div class="write-bar">${doneBar}<span class="status-dot" aria-hidden="true"></span><p class="write-status">${state.writeError ? `<span id="write-error" class="write-error"><span class="error-mark" aria-hidden="true">!</span>${E(state.writeError)}</span>` : ""}${charCount()}<span class="status-sep" aria-hidden="true"> · </span><span id="save-status">${E(storageMessage)}</span></p><p class="save-error"><span class="error-mark" aria-hidden="true">!</span><span><strong>저장하지 못했어요.</strong> 저장 공간을 확인하고 다시 시도해 주세요. <button type="button" class="storage-details" data-action="storage-details" ${failed ? "" : "hidden"}>원인 ⓘ</button></span></p><div class="write-actions">${options}${btn(lastStorageError ? "retry-save" : "save", lastStorageError ? "다시 시도" : saveLabel(), "primary")}</div></div>
    </div>
    <p class="save-note">작성한 내용은 이 화면에 그대로 남아 있어요. 저장되기 전에 창을 닫으면 사라질 수 있어요.</p>
    ${limitNotice()}
    <section class="recent-panel" aria-labelledby="recent-title"><div class="recent-head"><h2 id="recent-title">최근 기록</h2><div class="recent-tools">${btn("favorite-records", "☆ 즐겨찾기", "text-link")}${btn("archive-records", "전체 보기", "text-link")}</div></div><div class="recent-list">${recent.map(recentTile).join("") || '<p class="recent-empty">아직 남긴 기록이 없어요. 첫 기록을 남기면 여기에 쌓여요.</p>'}</div></section>
  </section>
  <aside class="write-side" data-view="${state.writeCalendar === "month" ? "month" : "week"}"${first ? ' data-first="true"' : ""} aria-label="${first ? "카드가 모이는 방법" : "오늘의 카드와 카드 달력"}">${first ? firstRunGuide() : todayPanel() + writeCalendar()}</aside>`;
}
// Card modal (desktop dialog, bottom sheet on phones): the day's card, ‹ › between recorded
// days, the record text and share / catalog actions. Survives re-renders through state.cardModal.
function cardModalHTML(date) {
  const record = dayRecord(date);
  if (!record) return "";
  const card = DiaryCards.resolve(record), ready = card.status === "ready";
  const days = recordDays(), i = days.indexOf(date);
  const title = ready ? `${CardexCore.type(card.type).name} · ${card.stage}단계` : card.status === "blank" ? "빈 카드" : card.status === "error" ? "분석 실패" : "분석 대기 카드";
  const meta = ready ? `${cardNumber(card.type, card.stage)} · 최고 확률 ${Math.round(card.score * 100)}% · 임시 분류${card.ties.length > 1 ? " · 공동 최다" : ""}`
    : card.status === "pending" ? "감정 분석이 연결되면 카드가 열려요" : card.status === "blank" ? "뚜렷한 대표 감정이 없는 기록이에요" : "기록은 그대로 읽을 수 있어요";
  const count = Array.from(record.text).length.toLocaleString("ko-KR");
  const actions = (["ready", "blank"].includes(card.status) ? `<button type="button" class="primary" data-modal="share">공유하기</button>` : "")
    + (ready ? `<button type="button" class="quiet" data-modal="catalog">도감에서 보기</button>` : "")
    + `<button type="button" class="text-link" data-modal="open">기록 자세히</button>`;
  // Figma "카드 모달": soft card area on the left (glow + foil hint), plain record text on the right.
  return `<div class="cm-stage"><span class="sheet-handle" aria-hidden="true"></span><span class="stage-glow" aria-hidden="true"></span><div class="cm-art"${gradeAttrs(card)}><div class="cm-tilt">${cardSVG(record)}<span class="cm-light" aria-hidden="true"></span></div></div><p class="cm-foil card-effect-hint"></p></div>
    <div class="cm-info">
      <div class="cm-top"><div class="cm-nav" role="group" aria-label="기록한 날 이동">${navArrow(-1, 'data-modal-step="-1"', "이전 기록", i <= 0)}<strong class="cm-date" aria-live="polite">${E(longDate(date))}</strong>${navArrow(1, 'data-modal-step="1"', "다음 기록", i >= days.length - 1)}</div><button type="button" class="quiet cm-close" data-modal="close" aria-label="닫기">✕</button></div>
      <h2 id="card-modal-title">${E(title)}</h2>
      <p class="cm-meta">${E(meta)}${state.mode === "example" ? " · 예시" : ""}</p>
      <hr class="cm-rule">
      <p class="cm-label">그날의 기록</p>
      <div class="cm-text" tabindex="0">${E(record.text)}</div>
      <div class="cm-actions">${actions}<small class="muted">${count}자</small></div>
    </div>`;
}
let disposeCardModalEffect = null;
function clearCardModalEffect() {
  disposeCardModalEffect?.();
  disposeCardModalEffect = null;
}
function openCardModal(date) {
  clearCardModalEffect();
  const dialog = app.querySelector("#card-modal"), html = cardModalHTML(date);
  if (!dialog || !html) { state.cardModal = null; return; }
  state.cardModal = date;
  state.calendarDay = date;
  dialog.innerHTML = html;
  const foil = dialog.querySelector(".cm-art:has(.cm-tilt)");
  if (foil) disposeCardModalEffect = DiaryFlip.bindFoil(foil);
  dialog.querySelectorAll("[data-modal-step]").forEach(b => b.onclick = () => {
    const step = Number(b.dataset.modalStep), days = recordDays(), next = days[days.indexOf(state.cardModal) + step];
    if (!next) return;
    openCardModal(next);
    const same = dialog.querySelector(`[data-modal-step="${step}"]`);
    (same && !same.disabled ? same : dialog.querySelector(`[data-modal-step="${-step}"]`))?.focus();
  });
  dialog.querySelectorAll("[data-modal]").forEach(b => b.onclick = () => {
    const record = dayRecord(state.cardModal), kind = b.dataset.modal;
    if (kind === "close" || !record) { dialog.close(); return; }
    state.cardModal = null;
    dialog.close();
    if (kind === "share") { openShare(record.id, "record"); return; }
    if (kind === "catalog") {
      const c = DiaryCards.resolve(record);
      Object.assign(state, { selected: record.id, catalogType: c.type, catalogStage: c.stage, catalogDetail: null, cardFilter: null, view: "history", archiveTab: "catalog" });
    } else Object.assign(state, { selected: record.id, entryFrom: "write", recordTab: "card", catalogDetail: null, view: "entry", editing: false, deleteConfirm: false });
    render(true);
  });
  if (!dialog.open) {
    dialog.showModal();
    dialog.addEventListener("close", () => {
      if (!dialog.isConnected) return;
      clearCardModalEffect();
      const from = state.cardModal;
      state.cardModal = null;
      // Back to the cell that opened it (record calendar, statistics dots or emotion calendar).
      if (state.view === "write" || state.view === "history") (app.querySelector(`.write-side [data-card-day="${from}"], .stats-calendar [data-card-day="${from}"]`) || app.querySelector(`[data-card-day="${from}"]`))?.focus({ preventScroll: true });
    }, { once: true });
  }
}
function bindHome() {
  clearCardModalEffect();
  app.querySelectorAll("[data-card-day]").forEach(b => b.onclick = () => openCardModal(b.dataset.cardDay));
  app.querySelectorAll("[data-write-calendar]").forEach(b => b.onclick = () => {
    state.writeCalendar = b.dataset.writeCalendar;
    if (state.writeCalendar === "week") syncCalendarWeek(state.homeMonth);
    else state.homeMonth = state.calendarWeek.slice(0, 7);
    render();
    app.querySelector(`[data-write-calendar="${state.writeCalendar}"]`)?.focus({ preventScroll: true });
  });
  // 오늘 작성 완료 → 수정하기: back into the text with the caret at the end.
  app.querySelector("[data-write-edit]")?.addEventListener("click", () => {
    const area = app.querySelector("#diary-text");
    if (!area) return;
    area.focus();
    area.setSelectionRange(area.value.length, area.value.length);
  });
  const dialog = app.querySelector("#card-modal");
  // Backdrop click closes the modal (the dialog box itself fills its content area).
  dialog?.addEventListener("click", e => { if (e.target === dialog) dialog.close(); });
  if (state.cardModal && (state.view === "write" || state.view === "history")) openCardModal(state.cardModal);
}
// Soft UI v1.1 top bar: brand on the left, three tabs in the middle, the profile avatar on
// the right (settings live on the profile page). Under 960px the tabs become a floating
// bottom bar (CSS only) while the brand and avatar stay at the top.
const NAV_TABS = [
  { id: "record", action: "write", label: "기록", icon: '<path d="M4 17.5V20h2.5L17 9.5 14.5 7 4 17.5Z"/><path d="m14.5 7 2.5 2.5 1.6-1.6a1.4 1.4 0 0 0 0-2L17.1 4.4a1.4 1.4 0 0 0-2 0L13.5 6"/>' },
  { id: "review", action: "review-month", label: "통계", icon: '<path d="M5 20v-8M12 20V5M19 20v-5"/><path d="M3.5 20h17"/>' },
  { id: "catalog", action: "catalog", label: "도감", icon: '<rect x="4.5" y="4" width="11" height="15" rx="2.5"/><path d="M18.5 7.5v10a3 3 0 0 1-3 3H9"/>' },
];
function currentTab() {
  if (state.view === "settings" || state.view === "themes") return "profile";
  if (state.view === "history") return state.archiveTab === "stats" ? "review" : state.archiveTab === "catalog" ? "catalog" : "record";
  if (state.view === "share") return state.shareFrom === "catalog" ? "catalog" : "record";
  return "record";
}
function mainNavigation() {
  const current = currentTab(), tab = NAV_TABS.find(t => t.id === current);
  const title = state.view === "share" ? "공유하기" : state.view === "history" && state.archiveTab === "records" ? "지난 기록" : current === "profile" ? "프로필" : tab.label;
  const tabs = NAV_TABS.map(t => btn(t.action, `<svg class="tab-icon" viewBox="0 0 24 24" aria-hidden="true">${t.icon}</svg><span>${t.label}</span>`, "tab", t.id === current ? 'aria-current="page"' : "")).join("");
  return `<button type="button" class="brand" data-action="write" aria-label="기록 홈으로 이동"><span class="brand-dot" aria-hidden="true"></span><span class="brand-word">moment</span><span class="screen-title sr-only">${title}</span></button><nav class="tabs" aria-label="주요 메뉴">${tabs}</nav><button type="button" class="avatar" data-action="settings" aria-label="프로필·설정"${current === "profile" ? ' aria-current="page"' : ""}><span class="avatar-face" style="--avatar:${profile.color}" aria-hidden="true">${profileIcon(profile.icon)}</span></button>`;
}
// Avatar icons (2026-11-22): six blob-style PNG faces (tools/build-profile-icons.mjs → assets/profile/*.png,
// embedded by tools/build.mjs) on the avatar color circle (top bar, profile card, icon and color options).
const PROFILE_ASSETS = /*__PROFILE_ASSETS__*/{};
function profileIcon(icon) {
  const id = MomentProfile.ICONS.includes(icon) ? icon : MomentProfile.DEFAULTS.icon;
  const src = PROFILE_ASSETS[id] || "";
  return `<img class="profile-icon" data-icon="${id}" src="${src}" alt="" draggable="false" decoding="async">`;
}

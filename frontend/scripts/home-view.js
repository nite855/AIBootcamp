// Home and archive share the same record rows and ordering.
function recordRow(record) {
  const card = DiaryCards.resolve(record);
  return `<button type="button" class="entry" data-open="${E(record.id)}"><span class="mini-art" aria-hidden="true">${card.status === "ready" ? characterSVG(card.type) : '<span class="record-glyph">✎</span>'}</span><span class="entry-meta"><strong class="entry-preview">${E(record.text.split("\n")[0])}</strong><small>${E(record.recordDate)} · ${E(timeLabel(record.createdAt))}</small><span class="entry-state">${record.favorite ? "★ 즐겨찾기 · " : ""}${E(cardLabel(record))}</span></span><span aria-hidden="true" class="entry-arrow">›</span></button>`;
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
  if (s.level === "full") return `<p id="privacy" class="privacy-note limit-note" data-level="full">보관 한도 30편에 도달했어요. 새 기록은 정리한 뒤에 남길 수 있어요. ${btn("backup-manage", "백업 후 정리하기")}</p>`;
  if (s.level === "near") return `<p id="privacy" class="privacy-note limit-note" data-level="near">이 브라우저에만 보관돼요 · <strong>${s.remaining}편 남았어요</strong> (최대 30편)</p>`;
  return `<p id="privacy" class="muted privacy-note">이 브라우저에만 보관돼요 · 최대 30편</p>`;
}
// Shown until the first record exists: how a record becomes an analyzed card.
function firstRunGuide() {
  return `<ol class="first-run" aria-label="이렇게 사용해요"><li>오늘의 기록을 한 줄이라도 남겨요.</li><li>감정 분석 모델이 기록을 읽어요. <small>지금은 분석 준비 중이에요.</small></li><li>분석된 감정이 카드와 캐릭터 도감으로 모여요.</li></ol><p class="small muted latest-storage">분류 확률은 감정의 강도가 아니에요. 설정 › 예시 모드에서 미리 볼 수 있어요.</p>`;
}
function homeView() {
  const recent = activeRecords().slice().sort(compareRecords).slice(0, 3);
  const latest = recent[0], card = DiaryCards.resolve(latest);
  const saved = state.policy === "multi" && state.savedText === state.text;
  return `<section class="editor home-editor" aria-labelledby="write-title"><div class="editor-content">
    <div class="row"><span class="eyebrow">TODAY'S PAGE</span>${state.mode === "example" ? '<span class="example-badge">예시 모드</span>' : ""}<span class="muted">${E(state.date)}</span></div>
    <h1 id="write-title"><span class="desktop-title">오늘은 어떤 하루였나요?</span><span class="mobile-title">오늘의 기록</span></h1><p class="muted">한 줄만 남겨도 괜찮아요.</p>
    <label for="diary-text" class="sr-only">오늘의 기록</label><textarea id="diary-text" placeholder="마음에 남은 순간을 적어 보세요." aria-describedby="char-count privacy save-status feedback">${E(state.text)}</textarea>
    <div class="storage-row">${charCount()}<span id="save-status" role="status">${E(storageMessage)}</span><button type="button" class="storage-details" data-action="storage-details" ${lastStorageError || !storeReady ? '' : 'hidden'}>저장 실패 · 원문은 유지돼요 ⓘ</button></div>
    ${limitNotice()}
    </div><div class="write-actions">${btn(lastStorageError ? "retry-save" : saved ? "new-entry" : "save", lastStorageError ? "저장 재시도" : saved ? "새 기록 쓰기" : "기록 남기기", "primary")}${more("draft-more", btn("help-write", "무엇을 쓸까요?", "quiet", 'aria-haspopup="dialog"') + btn("clear-draft", "초안 지우기") + '<p class="menu-note">기록은 다른 기기와 동기화되지 않아요. 브라우저 데이터를 삭제하면 기록도 사라져요.</p>', "작성 옵션")}</div></section>
    <aside class="home-aside" aria-label="나의 기록 요약"><section class="panel latest-panel" aria-labelledby="latest-title"><div class="row"><span class="eyebrow">MY MOMENT</span><span class="small muted">${state.mode === "example" ? "예시 모드" : "나의 기록"}</span></div><div class="latest-content"><div class="latest-art" aria-hidden="true">${latest && card.status === "ready" ? characterSVG(card.type) : `<img src="${objectAssets.heart}" alt="">`}</div><div><h2 id="latest-title">${latest ? E(cardLabel(latest)) : "오늘의 작은 시작"}</h2>${latest ? `<p class="muted">${E(latest.recordDate)}의 모먼트</p><p class="small muted latest-storage">${lastStorageError || !storeReady ? "저장 확인이 필요해요" : state.mode === "example" ? "예시 · 실제 입력 분석 아님" : "기록을 보관했어요 · 분석은 준비 중"}</p>` : firstRunGuide()}</div></div></section>
    <section class="panel recent-panel" aria-labelledby="recent-title"><div class="row"><h2 id="recent-title">최근 기록</h2><span class="small muted">${activeRecords().length}편</span></div><div class="entry-list recent-list">${recent.map(recordRow).join("") || '<div class="recent-empty"><span aria-hidden="true">✧</span><p>아직 기록이 없어요.</p><small>오늘의 첫 문장을 남겨 보세요.</small></div>'}</div></section></aside>`;
}
// Messenger-style navigation: a big screen title on the left and one tab set.
// Desktop shows the tabs as a pill segment in the header; under 960px the same
// nav becomes a bottom tab bar (CSS only), so every action exists exactly once.
const NAV_TABS = [
  { id: "today", action: "write", label: "오늘", title: "오늘의 기록", icon: '<path d="M4 17.5V20h2.5L17 9.5 14.5 7 4 17.5Z"/><path d="m14.5 7 2.5 2.5 1.6-1.6a1.4 1.4 0 0 0 0-2L17.1 4.4a1.4 1.4 0 0 0-2 0L13.5 6"/>' },
  { id: "records", action: "archive-records", label: "기록", title: "지난 기록", icon: '<path d="M6 4h9l3 3v13H6z"/><path d="M9 11h6M9 15h4"/>' },
  { id: "review", action: "review-month", label: "통계", title: "감정 통계", icon: '<path d="M4 19c3-1 4-9 7-9s3 5 5 5 3-6 4-8"/>' },
  { id: "catalog", action: "catalog", label: "도감", title: "캐릭터 도감", icon: '<path d="M12 20s-7-4.4-7-9.6A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7 2.4C19 15.6 12 20 12 20Z"/>' },
  { id: "settings", action: "settings", label: "설정", title: "설정", icon: '<circle cx="12" cy="12" r="3"/><path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6 18 18M6 18l1.4-1.4M16.6 7.4 18 6"/>' },
];
function currentTab() {
  if (state.view === "write") return "today";
  if (state.view === "settings" || state.view === "themes") return "settings";
  if (state.view === "entry") return state.entryFrom === "write" ? "today" : "records";
  if (state.view === "history") return state.archiveTab === "stats" ? "review" : state.archiveTab === "catalog" ? "catalog" : "records";
  return "today";
}
function mainNavigation() {
  const current = currentTab(), tab = NAV_TABS.find(t => t.id === current);
  return `<div class="topbar-title"><button type="button" class="brand" data-action="write" aria-label="오늘의 모먼트 · 메인으로"><small>✦ 오늘의 모먼트</small><span class="screen-title">${tab.label}</span></button></div><nav class="tabs" aria-label="주요 메뉴">${NAV_TABS.map(t => btn(t.action, `<svg class="tab-icon" viewBox="0 0 24 24" aria-hidden="true">${t.icon}</svg><span>${t.label}</span>`, "tab", t.id === current ? 'aria-current="page"' : "")).join("")}</nav>`;
}

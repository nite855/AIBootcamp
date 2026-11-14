// Home and archive share the same record rows and ordering.
function recordRow(record) {
  const card = DiaryCards.resolve(record);
  return `<button type="button" class="entry" data-open="${E(record.id)}"><span class="mini-art" aria-hidden="true">${card.status === "ready" ? characterSVG(card.type) : '<span class="record-glyph">✎</span>'}</span><span class="entry-meta"><strong class="entry-preview">${E(record.text.split("\n")[0])}</strong><small>${E(record.recordDate)} · ${E(timeLabel(record.createdAt))}</small><span class="entry-state">${record.favorite ? "★ 즐겨찾기 · " : ""}${E(cardLabel(record))}</span></span><span aria-hidden="true" class="entry-arrow">›</span></button>`;
}
function homeView() {
  const recent = activeRecords().slice().sort(compareRecords).slice(0, 3);
  const latest = recent[0], card = DiaryCards.resolve(latest);
  const saved = state.policy === "multi" && state.savedText === state.text;
  return `<section class="editor home-editor" aria-labelledby="write-title"><div class="editor-content">
    <div class="row"><span class="eyebrow">TODAY'S PAGE</span>${state.mode === "example" ? '<span class="example-badge">예시 모드</span>' : ""}<span class="muted">${E(state.date)}</span></div>
    <h1 id="write-title"><span class="desktop-title">오늘은 어떤 하루였나요?</span><span class="mobile-title">오늘의 기록</span></h1><p class="muted">한 줄만 남겨도 괜찮아요.</p>
    <label for="diary-text" class="sr-only">오늘의 기록</label><textarea id="diary-text" placeholder="마음에 남은 순간을 적어 보세요." aria-describedby="privacy save-status feedback">${E(state.text)}</textarea>
    <p id="writing-question" class="writing-question" hidden>오늘 잠깐이라도 마음이 편했던 순간은 언제였나요?</p>
    <div class="storage-row"><span id="save-status" role="status">${E(storageMessage)}</span><button type="button" class="storage-details" data-action="storage-details" ${lastStorageError || !storeReady ? '' : 'hidden'}>저장 실패 · 원문은 유지돼요 ⓘ</button></div>
    <p id="privacy" class="muted privacy-note">이 브라우저에만 보관돼요 · 최대 30편</p>
    </div><div class="write-actions">${btn(lastStorageError ? "retry-save" : saved ? "new-entry" : "save", lastStorageError ? "저장 재시도" : saved ? "새 기록 쓰기" : "기록 남기기", "primary")}${more("draft-more", btn("help-write", "무엇을 쓸까요?", "quiet", 'aria-expanded="false" aria-controls="writing-question"') + btn("clear-draft", "초안 지우기") + '<p class="menu-note">기록은 다른 기기와 동기화되지 않아요. 브라우저 데이터를 삭제하면 기록도 사라져요.</p>', "작성 옵션")}</div></section>
    <aside class="home-aside" aria-label="나의 기록 요약"><section class="panel latest-panel" aria-labelledby="latest-title"><div class="row"><span class="eyebrow">MY MOMENT</span><span class="small muted">${state.mode === "example" ? "예시 모드" : "나의 기록"}</span></div><div class="latest-content"><div class="latest-art" aria-hidden="true">${latest && card.status === "ready" ? characterSVG(card.type) : `<img src="${objectAssets.heart}" alt="">`}</div><div><h2 id="latest-title">${latest ? E(cardLabel(latest)) : "오늘의 작은 시작"}</h2><p class="muted">${latest ? E(latest.recordDate) + "의 모먼트" : "당신의 하루를 기다리고 있어요."}</p><p class="small muted latest-storage">${latest ? (lastStorageError || !storeReady ? "저장 확인이 필요해요" : state.mode === "example" ? "예시 · 실제 입력 분석 아님" : "기록을 보관했어요 · 분석은 준비 중") : "기록을 남기면 이곳에 모여요."}</p></div></div></section>
    <section class="panel recent-panel" aria-labelledby="recent-title"><div class="row"><h2 id="recent-title">최근 기록</h2><span class="small muted">${activeRecords().length}편</span></div><div class="entry-list recent-list">${recent.map(recordRow).join("") || '<div class="recent-empty"><span aria-hidden="true">✧</span><p>아직 기록이 없어요.</p><small>오늘의 첫 문장을 남겨 보세요.</small></div>'}</div></section></aside>`;
}
function mainNavigation() {
  return `<button type="button" class="brand" data-action="write" aria-label="오늘의 모먼트 · 메인으로">✦ 오늘의 모먼트<small>작은 하루, 나만의 페이지</small></button><nav class="icons" aria-label="주요 메뉴">${btn("archive-records", "기록", "quiet", state.view === "history" && state.archiveTab === "records" ? 'aria-current="page"' : "")}${more("main-menu", btn("review-month", "돌아보기") + btn("catalog", "캐릭터 도감") + btn("settings", "설정"), "메뉴")}</nav>`;
}

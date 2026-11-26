// Card reveal, card information panel and the share sheet (Figma v0.3 "카드 등장" and "공유").
// Included inside the app closure next to the other views.

// ── Card information under the stage (Figma "카드 공개 · 2단계", second pass 2026-11-20) ──
// Centered copy (26px title, one subtitle line) and the actions: 도감에 넣기 (toast + the card's
// catalog detail), 공유하기, and 자세히 보기 — a menu that keeps 기록 읽기, 이미지 저장, 즐겨찾기,
// 수정하기 and 삭제 (Figma has no slot for them).
function cardInfo(record) {
  const card = DiaryCards.resolve(record);
  const t = card.status === "ready" ? CardexCore.type(card.type) : null;
  const example = state.mode === "example";
  const title = card.status === "ready" ? `${t.name} · ${card.stage}단계 카드를 얻었어요`
    : card.status === "blank" ? "빈 카드를 얻었어요"
    : card.status === "error" ? "분석을 완료하지 못했어요"
    : "기록은 잘 저장됐어요";
  const copy = card.status === "ready" ? `최고 확률 ${Math.round(card.score * 100)}% · 임시 분류 · ${example ? "시연용 예시 분석이에요" : "확률은 감정의 강도가 아니에요"}`
    : card.status === "blank" ? `최고 확률 ${Math.round(card.score * 100)}% · 뚜렷한 대표 감정이 없는 기록이에요`
    : card.status === "error" ? "기록은 그대로 읽을 수 있어요 · 분석 결과만 사용하지 않아요"
    : "감정 읽기가 준비되면 카드가 열려요 · AI 감정 읽기는 아직 연결 전이에요";
  const failed = state.mode === "real" && (lastStorageError || !storeReady);
  const menu = more("card-more", btn("read-full", "기록 읽기", "quiet")
    + (["ready", "blank"].includes(card.status) ? btn("download", "이미지 저장", "quiet", state.busy ? "disabled" : "") : "")
    + btn("favorite", record.favorite ? "★ 즐겨찾기 해제" : "☆ 즐겨찾기", "quiet", `aria-pressed="${Boolean(record.favorite)}"`)
    + (state.view === "entry" ? btn("edit-example", "수정하기") : "")
    + btn("delete-example", "삭제", "quiet danger"), "자세히 보기");
  const main = card.status === "ready" ? btn("card-catalog", "도감에서 보기", "primary") + `<button type="button" class="secondary" data-action="share">공유하기</button>`
    : card.status === "blank" ? `<button type="button" class="primary" data-action="share">공유하기</button>`
    : btn("write", "기록으로 돌아가기", "primary") + btn("catalog", "도감 보기", "secondary");
  return `<section class="card-info" aria-labelledby="card-info-title"><h2 id="card-info-title">${E(title)}</h2><p class="card-info-copy muted">${E(copy)}</p><div class="card-info-actions">${failed ? btn("retry-save", "다시 시도", "secondary", 'aria-label="저장 다시 시도"') : ""}${main}${menu}</div></section>`;
}
// Small chip in the stage's top-left corner (Figma "새 카드").
function stageChip(record) {
  const card = DiaryCards.resolve(record);
  const label = card.status === "ready" ? "새 카드" : card.status === "blank" ? "빈 카드" : card.status === "error" ? "분석 실패" : "봉인된 카드";
  return `<span class="stage-chip" data-status="${card.status}"><i aria-hidden="true"></i>${label}</span>`;
}

// ── Reveal: sealed "?" card → tap → flip → grade effect → result (Figma 카드 등장 ①~⑤) ──
// Saving a real record opens the card page sealed; example records seal on their first open per session.
// The real .flip-scene only fades (opacity/filter) so its geometry, pointer hits and tilt/flip layers stay intact;
// the mystery card and the grade burst are separate overlays. A card counts as revealed once it is tapped.
// 2026-11-20: the burst color follows the emotion (data-emotion on .card-box); the grade picks the effect.
// blank = short grey dust, stage-1 = soft bloom + sheen, stage-2 = double ring + bounce, stage-3 = rays,
// holo ring, tinted flash and confetti. Particle counts and travel distance grow with the grade.
const GRADE_PARTICLES = { pending: 6, error: 6, blank: 6, "stage-1": 10, "stage-2": 16, "stage-3": 28 };
const GRADE_REACH = { blank: 70, "stage-1": 170, "stage-2": 210, "stage-3": 250 };
const GRADE_REVEAL_MS = 1700;
let revealTimer = 0;
function gradeParticles(grade) {
  const n = GRADE_PARTICLES[grade] || 6, reach = GRADE_REACH[grade] || 170;
  return Array.from({ length: n }, (_, i) => `<i style="--a:${Math.round(i * 360 / n + (i % 2 ? 9 : 0))}deg;--d:${(i % 3) * 40 + reach}px;--s:${(i % 4) * 2 + 6}px;--delay:${(i % 5) * 35}ms"></i>`).join("");
}
// Real records: the version just saved. Example records: once per record, so editing one never replays it.
// The legend names the effect of each grade (the color now belongs to the emotion).
// 2026-11-24: the effect names follow the strengthened card ladder (grade-effects.css "Grade ladder").
const SEAL_GRADES = [["blank", "빈 카드", "빈 슬롯"], ["stage-1", "1단계", "은은한 빛"], ["stage-2", "2단계", "금속 이중 링"], ["stage-3", "3단계", "홀로그램 포일"]];
const SEAL_EFFECT = Object.fromEntries(SEAL_GRADES.map(([g, label, effect]) => [g, [label, effect]]));
// Soft UI v1.1 draw sequence (Figma 07 "카드 뽑기 연출"): ① 두근두근 1.5s → ② 고조 1.2s → ③ 펑 (burst,
// GRADE_REVEAL_MS) → ④ front with the result. Each grade plays the same way every time; tapping the card never
// shortcuts it. 2026-11-24: a "건너뛰기" button jumps to ③ (the grade burst still plays; a second press or Esc
// shows the result), and reduced-motion devices get a still variant with the same timing (grade-effects.css).
// Start times survive re-renders so the phases never restart.
const DRAW_PHASES = { charge: 1500, rise: 1200 };
const drawStarted = {};
const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
function sealHint() {
  const legend = SEAL_GRADES.map(([g, label, effect]) => `<li data-effect="${g}"><i aria-hidden="true"></i><b>${label}</b><span>${effect}</span></li>`).join("");
  const note = reducedMotion() ? `<p class="seal-motion-note">기기 설정에 맞춰 움직임을 줄여 보여드려요</p>` : "";
  return `<section class="seal-hint" aria-labelledby="seal-hint-title"><h2 id="seal-hint-title" aria-live="polite">오늘의 마음을 카드로 만들고 있어요</h2><p class="seal-sub muted">기록 속 감정을 읽는 중이에요</p><div class="draw-progress" aria-hidden="true"><i></i></div><p class="draw-caption" aria-hidden="true">감정 읽는 중 · <span class="draw-pct">0</span>%</p><ul class="seal-legend" aria-label="빛의 색은 감정, 공개 효과는 등급에 따라 달라요">${legend}</ul>${note}<button type="button" class="secondary seal-skip" data-reveal-skip>건너뛰기</button></section>`;
}
// Real records stay "분석 대기" until the model is connected: no draw, just this panel (Figma "카드 등장 · 분석 대기").
// 2026-11-24 critique ("다정한 마무리"): the save is the peak of the day, so the panel gives the writer's own
// first sentence back with the day, and one warm line. No numbers, no streaks, and no invented emotion.
function waitPanel(record) {
  const line = record ? MomentShare.firstSentence(record.text) : "";
  const quote = line ? `<figure class="wait-quote"><blockquote><p>“${E(line)}”</p></blockquote><figcaption>${E(longDate(record.recordDate))}의 기록</figcaption></figure>` : "";
  return `<section class="wait-panel" aria-labelledby="wait-title"><ol class="wait-steps" aria-label="진행 단계"><li class="is-done">저장 <span aria-hidden="true">✓</span></li><li class="is-current" aria-current="step">감정 읽기 <small>대기</small></li><li>카드 공개</li></ol><h2 id="wait-title" tabindex="-1">기록은 잘 저장됐어요</h2>${quote}<p class="muted">오늘도 하루를 남겼어요. 카드는 봉인해 두었다가, 감정 읽기가 준비되면 열어 드릴게요.</p><div class="card-info-actions"><button type="button" class="primary" data-wait-action="write">기록으로 돌아가기</button><button type="button" class="secondary" data-wait-action="catalog">도감 보기</button></div></section>`;
}
let waitFocus = false; // set by openSavedCard() (app.js), used once by showWait()
function revealKey(record) { return state.mode === "example" ? `example:${record.id}` : `real:${record.id}:${record.version}`; }
function revealCard() {
  const box = app.querySelector(".record-panel .card-box"), record = state.view === "entry" ? currentRecord() : null;
  if (!box || !record || !box.querySelector(".flip-scene")) return false;
  const key = revealKey(record);
  if (state.revealed[key]) return false;
  if (state.mode === "real" && state.pendingReveal !== key) return false;
  const grade = DiaryCards.grade(DiaryCards.resolve(record));
  if (grade === "pending") {
    // Only a real save gets the wait panel; an example pending card simply opens.
    if (state.mode === "real") { showWait(box); return true; }
    state.revealed[key] = true;
    return false;
  }
  sealCard(box, key, grade);
  return true;
}
// The wait panel takes the information column until the writer leaves the page (render() clears pendingReveal).
function showWait(box) {
  const layout = box.closest(".record-layout"), info = layout?.querySelector(".card-info");
  if (!layout || !info) return;
  layout.classList.add("is-waiting");
  box.dataset.reveal = "pending";
  info.inert = true; info.setAttribute("aria-hidden", "true");
  // 2026-11-24 critique: the panel used to sit under the stage, so "기록은 잘 저장됐어요" fell below the fold
  // (1440×900 and phones) and the save toast covered it. It now comes first; the card follows. The foil hint
  // does not belong on a card that is still waiting (flip.js leaves .is-waiting pages alone).
  const stage = layout.querySelector(".card-stage");
  (stage || info).insertAdjacentHTML(stage ? "beforebegin" : "afterend", waitPanel(currentRecord()));
  layout.closest(".record-panel")?.querySelector(".record-top .card-effect-hint")?.remove();
  layout.querySelectorAll("[data-wait-action]").forEach(b => b.onclick = () => action(b.dataset.waitAction));
  // Right after a save the editor that had focus is gone; move focus to the panel title once
  // (later re-renders of the same page keep whatever the writer focused).
  if (waitFocus) { waitFocus = false; layout.querySelector("#wait-title")?.focus({ preventScroll: true }); }
}
function sealCard(box, key, grade) {
  const layout = box.closest(".record-layout");
  const hidden = [box.querySelector(".flip-scene"), ...(layout ? layout.querySelectorAll(".card-info, .card-area > .caption, .card-area > .card-actions") : [])];
  layout?.classList.add("is-sealed");
  // Guidance in the empty information column while the card is sealed (same grid cell as .card-info).
  layout?.querySelector(".card-info")?.insertAdjacentHTML("afterend", sealHint());
  box.classList.add("is-sealed");
  box.dataset.reveal = grade;
  hidden.forEach(el => { el.inert = true; el.setAttribute("aria-hidden", "true"); });
  box.insertAdjacentHTML("afterbegin", `<div class="mystery-card" role="img" tabindex="-1" aria-label="오늘의 카드를 만드는 중 · 잠시 후 저절로 열려요"><span class="mystery-inner"><span class="mystery-face mystery-back"><span class="mystery-window" aria-hidden="true"><span class="mystery-q">?</span></span><span class="mystery-band" aria-hidden="true"><small>Today</small><b>오늘의 카드</b><span>어떤 마음이 나올까요?</span><i>No.???</i></span><em>두근두근</em></span><span class="mystery-face mystery-front" aria-hidden="true"></span></span></div><span class="draw-ghost draw-ghost-1" aria-hidden="true"></span><span class="draw-ghost draw-ghost-2" aria-hidden="true"></span><div class="grade-burst" aria-hidden="true"><span class="grade-rays"></span><span class="grade-ring"></span><span class="grade-ring grade-ring-2"></span><span class="grade-particles">${gradeParticles(grade)}</span></div>`);
  const button = box.querySelector(".mystery-card"), scene = box.querySelector(".flip-scene");
  const hint = layout?.querySelector(".seal-hint");
  // The sealed card covers the real card exactly (its size comes from DiaryFlip's ResizeObserver).
  const syncSize = () => { box.style.setProperty("--seal-w", scene.offsetWidth + "px"); box.style.setProperty("--seal-h", scene.offsetHeight + "px"); };
  syncSize();
  const sizer = new ResizeObserver(syncSize);
  sizer.observe(scene);
  // Focus after render() finishes its own focus handling, unless the writer is typing somewhere.
  queueMicrotask(() => { if (button.isConnected && !document.activeElement?.matches("input, textarea")) button.focus({ preventScroll: true }); });
  const timers = [];
  const setPhase = phase => {
    box.dataset.phase = phase;
    const title = hint?.querySelector("#seal-hint-title"), em = button.querySelector("em");
    if (phase === "rise") { if (title) title.textContent = "곧 열려요…"; if (em) em.textContent = "곧 열려요"; const sub = hint?.querySelector(".seal-sub"); if (sub) sub.textContent = "카드가 반응하고 있어요. 두근두근"; }
  };
  // ④ result: remove the seal and show the information panel (with focus on its title).
  const keys = new AbortController();
  const finish = () => {
    timers.forEach(clearTimeout);
    clearTimeout(revealTimer);
    keys.abort();
    sizer.disconnect();
    if (!box.isConnected) return;
    state.revealed[key] = true;
    if (state.pendingReveal === key) state.pendingReveal = null;
    box.classList.remove("is-flipping", "is-sealed");
    delete box.dataset.phase;
    layout?.classList.remove("is-sealed");
    box.querySelectorAll(".mystery-card, .grade-burst").forEach(el => el.remove());
    layout?.querySelector(".seal-hint")?.remove();
    layout?.querySelector(".card-info")?.classList.add("just-revealed");
    // Figma ④: a NEW! badge on analyzed cards and a few confetti left in the stage.
    if (grade.startsWith("stage-")) { box.insertAdjacentHTML("beforeend", '<span class="new-badge" aria-hidden="true">NEW!</span>'); box.closest(".card-stage")?.classList.add("has-confetti"); }
    hidden.forEach(el => { el.inert = false; el.removeAttribute("aria-hidden"); });
    // The flip-back face manages its own inert/aria state; restore it after un-hiding the scene.
    const back = box.querySelector(".flip-back");
    if (back && !box.querySelector(".flip-scene.flipped")) { back.inert = true; back.setAttribute("aria-hidden", "true"); }
    const title = app.querySelector("#card-info-title");
    if (title) { title.tabIndex = -1; title.focus({ preventScroll: true }); }
    // A "new card" badge held back during the draw shows now, over the result (celebrate-view.js).
    if (typeof flushCelebration === "function") flushCelebration();
  };
  // ③ burst: flip the sealed card, play the grade effect, then finish.
  const open = () => {
    if (!box.isConnected || box.classList.contains("is-flipping")) return;
    timers.forEach(clearTimeout);
    state.revealed[key] = true;
    if (state.pendingReveal === key) state.pendingReveal = null;
    box.dataset.phase = "burst";
    box.classList.replace("is-sealed", "is-flipping");
    // The grade in words as the burst starts (aria-live title), so it reads without the effect too.
    const [label, effect] = SEAL_EFFECT[grade] || [];
    const title = hint?.querySelector("#seal-hint-title");
    if (title && label) title.textContent = grade === "blank" ? `빈 카드예요 · ${effect}` : `${label} · ${effect} 카드예요`;
    const pctNow = hint?.querySelector(".draw-pct"), barNow = hint?.querySelector(".draw-progress i");
    if (pctNow) pctNow.textContent = "100";
    if (barNow) barNow.style.width = "100%";
    const skip = hint?.querySelector("[data-reveal-skip]");
    if (skip) skip.textContent = "바로 보기";
    if (grade === "stage-3") {
      document.querySelector(".grade-flash")?.remove();
      const flash = document.createElement("div");
      flash.className = "grade-flash";
      flash.setAttribute("aria-hidden", "true");
      // The flash lives on <body>, so it borrows the card's emotion color explicitly.
      flash.style.setProperty("--flash", getComputedStyle(box).getPropertyValue("--grade").trim() || "#f6b73c");
      document.body.append(flash);
      setTimeout(() => flash.remove(), 1600);
    }
    clearTimeout(revealTimer);
    revealTimer = setTimeout(finish, GRADE_REVEAL_MS);
  };
  // ①② run on their own; a re-render resumes from the time the draw first started.
  const started = drawStarted[key] ??= Date.now(), elapsed = Date.now() - started;
  const riseAt = DRAW_PHASES.charge, burstAt = DRAW_PHASES.charge + DRAW_PHASES.rise;
  const bar = hint?.querySelector(".draw-progress i");
  if (bar) bar.style.animationDelay = -elapsed + "ms";
  // The caption follows the bar from the same start time, so a re-render never restarts it.
  const pct = hint?.querySelector(".draw-pct"), caption = hint?.querySelector(".draw-caption");
  const tick = () => {
    if (!pct?.isConnected || !box.classList.contains("is-sealed")) return;
    const p = Math.min(100, Math.round((Date.now() - started) / burstAt * 100));
    pct.textContent = p;
    // Inline width keeps the bar moving where the CSS fill is switched off (reduced motion).
    if (bar && reducedMotion()) bar.style.width = p + "%";
    if (p >= 100) { caption.firstChild.textContent = "감정 읽기 완료 · "; return; }
    requestAnimationFrame(tick);
  };
  tick();
  setPhase(elapsed >= riseAt ? "rise" : "charge");
  if (elapsed < riseAt) timers.push(setTimeout(() => box.isConnected && box.classList.contains("is-sealed") && setPhase("rise"), riseAt - elapsed));
  timers.push(setTimeout(() => box.isConnected && box.classList.contains("is-sealed") && open(), Math.max(0, burstAt - elapsed)));
  // 건너뛰기: ①② → ③ burst (the grade effect still plays); during ③ → result. Esc does the same.
  const skip = () => {
    if (!box.isConnected) return;
    if (box.classList.contains("is-sealed")) open();
    else if (box.classList.contains("is-flipping")) finish();
  };
  hint?.querySelector("[data-reveal-skip]")?.addEventListener("click", skip, { signal: keys.signal });
  document.addEventListener("keydown", e => {
    if (!box.isConnected) { keys.abort(); return; }
    if (e.key !== "Escape" || e.defaultPrevented || document.querySelector("dialog[open]")) return;
    e.preventDefault();
    skip();
  }, { signal: keys.signal });
}

// ── Share sheet (soft UI v1.1 "카드 공유하기", 2026-11-20 P8) ──
// Preview 1080×1350 (and an Instagram story 1080×1920): brand, card, optional date, emotion name and
// probability, and by default the record's first sentence (MomentShare, ≤40 chars). The rest of the
// diary is never drawn, and grade effects never reach the PNG.
const SHARE_FORMATS = [["card", "카드 중심"], ["record", "기록 중심"], ["mixed", "카드+기록"]];
const SHARE_SENTENCE_MAX = MomentShare.QUOTE_MAX;
// Figma "공유 · 미리보기" copy; the probability is hidden by default (2026-11-21 F6).
const SHARE_OPTIONS = [["quote", "기록 문장 넣기", "한 줄 인용으로 들어가요"], ["date", "날짜 표시", ""], ["name", "감정 이름 표시", "임시 이름이 그대로 보여요"], ["prob", "분석 확률 표시", "기본은 꺼져 있어요 · 감정의 강도가 아닌 분류 확률이에요"]];
// 2026-11-24: the only inverted switch ("확률 숨기기", on = hidden) became "분석 확률 표시" (on = shown); default still hides it.
const shareDefaults = () => ({ quote: true, date: true, name: true, prob: false });
function shareRecord() { return activeRecords().find(r => r.id === state.selected) || null; }
function shareQuote(record) { return state.shareOpts.quote ? MomentShare.quote(record, state.shareSentence) : ""; }
// The card SVG without its root element and <desc> (the description carries the probability text).
function shareCardInner(record) {
  return cardSVG(record, { snippet: false, name: state.shareOpts.name }).replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "").replace(/<desc>[\s\S]*?<\/desc>/, "");
}
function shareLabels(record) {
  const card = DiaryCards.resolve(record), ready = card.status === "ready";
  const name = !state.shareOpts.name ? "오늘의 카드" : ready ? `${CardexCore.type(card.type).name} · ${card.stage}단계` : "빈 카드";
  const prob = !state.shareOpts.prob ? "" : `최고 확률 ${Math.round(card.score * 100)}%`;
  return { name, prob, date: state.shareOpts.date ? dotDate(record.recordDate) : "" };
}
// Character wrapping for the quote (SVG has no automatic line breaks).
// Wraps at spaces (a word longer than a line is split by characters). Text that needs more lines ends
// the last one with "…" and keeps the closing quote, which used to fall off the image (2026-11-24).
function shareWrap(text, size, max, x, lines = 3) {
  const len = s => Array.from(s).length, out = []; let line = "";
  for (const word of String(text).split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (len(next) <= max) { line = next; continue; }
    if (line) out.push(line);
    let rest = Array.from(word);
    while (rest.length > max) { out.push(rest.slice(0, max).join("")); rest = rest.slice(max); }
    line = rest.join("");
  }
  if (line) out.push(line);
  if (out.length > lines) {
    const closing = /”$/.test(text) ? "”" : "";
    out.length = lines;
    out[lines - 1] = Array.from(out[lines - 1]).slice(0, Math.max(1, max - 1 - closing.length)).join("").trimEnd() + "…" + closing;
  }
  return out.map((l, i) => `<tspan x="${x}" dy="${i ? size * 1.4 : 0}">${E(l)}</tspan>`).join("");
}
function shareCard(record, x, y, w, rotate = 0) {
  return `<g transform="rotate(${rotate} ${x + w / 2} ${y + w * .7})"><rect x="${x + 10}" y="${y + 22}" width="${w}" height="${w * 1.4}" rx="${w * .09}" fill="#111114" opacity=".14"/><svg x="${x}" y="${y}" width="${w}" height="${w * 1.4}" viewBox="0 0 1080 1512">${shareCardInner(record)}</svg></g>`;
}
function shareBrand(x, y, ink) {
  return `<circle cx="${x + 14}" cy="${y - 11}" r="14" fill="#ffb3c7"/><text x="${x + 40}" y="${y}" font-family="Bricolage Grotesque, Moment Sans, sans-serif" font-size="34" font-weight="700" fill="${ink}">moment</text>`;
}
function shareSVG() {
  const record = shareRecord(), q = shareQuote(record), L = shareLabels(record);
  const css = getComputedStyle(document.documentElement), token = n => css.getPropertyValue(n).trim();
  const paper = token("--paper") || "#ffffff", ink = token("--ink") || "#111114", muted = token("--muted") || "#5f5f68";
  const meta = (x, y, anchor = "middle") => `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="46" font-weight="800" fill="${ink}">${E(L.name)}</text>${L.prob ? `<text x="${x}" y="${y + 52}" text-anchor="${anchor}" font-size="30" fill="${muted}">${E(L.prob)} · 임시 분류</text>` : ""}`;
  let body;
  if (state.shareFormat === "record") {
    body = `${q ? `<text x="100" y="330" font-size="64" font-weight="300" fill="${ink}">${shareWrap("“" + q + "”", 64, 13, 100, 4)}</text>` : `<text x="100" y="330" font-size="56" font-weight="300" fill="${muted}">오늘의 모먼트</text>`}${shareCard(record, 640, 760, 340, 6)}${meta(100, 1130, "start")}`;
  } else if (state.shareFormat === "mixed") {
    body = `${shareCard(record, 80, 250, 470, -4)}${q ? `<text x="610" y="470" font-size="46" font-weight="400" fill="${ink}">${shareWrap("“" + q + "”", 46, 9, 610, 5)}</text>` : ""}${meta(610, q ? 860 : 520, "start")}`;
  } else {
    // Figma "카드 중심": a soft glow, the straight card in the middle (its band carries the name),
    // the quote centered under it; the probability only when it is not hidden.
    const glow = `<defs><radialGradient id="share-glow"><stop offset="0" stop-color="${cardGlow(record)}" stop-opacity=".55"/><stop offset="1" stop-color="${cardGlow(record)}" stop-opacity="0"/></radialGradient></defs><circle cx="540" cy="590" r="470" fill="url(#share-glow)"/>`;
    body = `${glow}${shareCard(record, 250, 180, 580, 0)}${q ? `<text x="540" y="1112" text-anchor="middle" font-size="40" fill="${ink}">${shareWrap("“" + q + "”", 40, 20, 540, 2)}</text>` : ""}${L.prob ? `<text x="540" y="${q ? 1250 : 1120}" text-anchor="middle" font-size="28" fill="${muted}">${E(L.prob)} · 임시 분류</text>` : ""}`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350" role="img" aria-label="${E(L.name)} 공유 이미지 미리보기" class="share-art"><rect width="1080" height="1350" fill="${paper}"/><g font-family="Moment Sans, sans-serif">${shareBrand(76, 100, ink)}${L.date ? `<text x="1004" y="100" text-anchor="end" font-family="Bricolage Grotesque, Moment Sans, sans-serif" font-size="34" font-weight="500" fill="${muted}">${E(L.date)}</text>` : ""}${body}</g></svg>`;
}
// Glow color behind the shared card: the emotion's mix color, or a neutral tint for blank cards.
function cardGlow(record) {
  const card = DiaryCards.resolve(record);
  return card.status === "ready" ? cardPalette(card.type).mix : "#e6e6eb";
}
// Instagram story (9:16): the card's own colors as the background, card large in the middle.
function storySVG() {
  const record = shareRecord(), q = shareQuote(record), L = shareLabels(record), card = DiaryCards.resolve(record);
  const c = card.status === "ready" ? cardPalette(card.type) : { base: "#e6e6eb", mix: "#f3f3f6" };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920" class="story-art"><defs><linearGradient id="story-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.mix}"/><stop offset="1" stop-color="${c.base}"/></linearGradient></defs><rect width="1080" height="1920" fill="url(#story-bg)"/><g font-family="Moment Sans, sans-serif">${shareBrand(90, 180, "#111114")}${L.date ? `<text x="990" y="180" text-anchor="end" font-family="Bricolage Grotesque, Moment Sans, sans-serif" font-size="34" fill="#111114" fill-opacity=".6">${E(L.date)}</text>` : ""}${shareCard(record, 190, 330, 700, -2)}<text x="540" y="1420" text-anchor="middle" font-size="58" font-weight="800" fill="#111114">${E(L.name)}</text>${L.prob ? `<text x="540" y="1484" text-anchor="middle" font-size="34" fill="#111114" fill-opacity=".6">${E(L.prob)} · 임시 분류</text>` : ""}${q ? `<text x="540" y="1600" text-anchor="middle" font-size="44" fill="#111114">${shareWrap("“" + q + "”", 44, 20, 540, 2)}</text>` : ""}</g></svg>`;
}
function canDeviceShare() {
  try { return typeof navigator.share === "function" && typeof navigator.canShare === "function" && navigator.canShare({ files: [new File([""], "moment.png", { type: "image/png" })] }); } catch { return false; }
}
function sharePanel() {
  const record = shareRecord(), card = DiaryCards.resolve(record);
  if (!record || !["ready", "blank"].includes(card.status)) { state.view = record ? "entry" : "write"; return state.view === "entry" ? panel() : homeView(); }
  const L = shareLabels(record), auto = MomentShare.firstSentence(record.text);
  const toggle = ([key, label, sub]) => `<label class="switch-row share-option"><span><strong>${label}</strong>${sub ? `<small class="muted">${sub}</small>` : ""}</span><input type="checkbox" role="switch" data-share-opt="${key}" ${state.shareOpts[key] ? "checked" : ""}></label>`;
  return `<section class="share-page" aria-labelledby="share-title"><button type="button" class="share-back" data-share-back>← ${state.shareFrom === "catalog" ? "카드 상세" : "카드로"}</button><div class="share-head page-heading"><h2 id="share-title" class="share-title">카드 공유하기</h2><p class="muted">${E(card.status === "ready" ? `${CardexCore.type(card.type).name} · ${card.stage}단계` : "빈 카드")} · ${E(dotDate(record.recordDate))}</p></div>
    <div class="share-layout"><div class="share-preview share-stage"><div class="share-art-frame grade-aura-frame"${gradeAttrs(card)}>${shareSVG()}</div><div class="share-formats" role="group" aria-label="공유 형식">${SHARE_FORMATS.map(([id, label]) => `<button type="button" class="chip" data-share-format="${id}" aria-pressed="${state.shareFormat === id}">${label}</button>`).join("")}</div><p class="sr-only share-caption">4:5 · 1080×1350 미리보기</p></div>
    <section class="panel share-sheet" aria-label="공유 옵션"><h3>공유 옵션</h3><div class="share-options">${SHARE_OPTIONS.map(toggle).join("")}</div>
    <label class="share-sentence" ${state.shareOpts.quote ? "" : "hidden"}><span>인용 문장 <small>비우면 첫 문장 · 최대 ${SHARE_SENTENCE_MAX}자</small></span><input id="share-sentence" type="text" maxlength="${SHARE_SENTENCE_MAX}" placeholder="${E(auto || "인용할 문장을 적어 보세요")}" value="${E(state.shareSentence)}"></label>
    <p class="share-privacy">인용 문장 말고 기록 본문은 이미지에 들어가지 않아요</p>
    <div class="share-actions">${btn("share-download", "이미지로 저장", "primary", state.busy ? "disabled" : "")}${btn("share-story", "인스타그램 스토리로 공유", "secondary", state.busy ? "disabled" : "")}${btn("share-link", "앱 주소 복사", "secondary", 'aria-describedby="share-link-note"')}</div><p class="share-link-note" id="share-link-note">앱 주소만 복사돼요 · 받는 사람에게 내 카드나 기록은 보이지 않아요</p><div class="share-foot"><small>${canDeviceShare() ? "스토리는 기기 공유 창으로 보내요." : "스토리 이미지는 저장한 뒤 인스타그램에서 올려 주세요."}</small>${btn("share-close", "닫기", "quiet")}</div></section></div></section>`;
}
async function svgToPNG(svg, width, height) {
  await document.fonts.ready;
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = new Image();
    await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = () => reject(Error("이미지를 만들지 못했어요. 다시 시도해 주세요.")); img.src = url; });
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw Error("이 브라우저에서는 이미지 저장이 어려워요.");
    ctx.drawImage(img, 0, 0);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw Error("이미지를 만들지 못했어요.");
    return blob;
  } finally { URL.revokeObjectURL(url); }
}
const sharePNG = () => svgToPNG(shareSVG(), 1080, 1350);
function downloadBlob(blob, fileName) {
  const link = document.createElement("a"), url = URL.createObjectURL(blob);
  link.href = url; link.download = fileName; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
function bindShare() {
  app.querySelectorAll("[data-share-format]").forEach(b => (b.onclick = () => { state.shareFormat = b.dataset.shareFormat; render(); app.querySelector(`[data-share-format="${state.shareFormat}"]`)?.focus(); }));
  app.querySelectorAll("[data-share-opt]").forEach(input => (input.onchange = () => {
    state.shareOpts = { ...state.shareOpts, [input.dataset.shareOpt]: input.checked };
    render();
    app.querySelector(`[data-share-opt="${input.dataset.shareOpt}"]`)?.focus();
  }));
  const input = app.querySelector("#share-sentence");
  if (input) input.oninput = () => {
    state.shareSentence = input.value.slice(0, SHARE_SENTENCE_MAX);
    const frame = app.querySelector(".share-art-frame"); if (frame) frame.innerHTML = shareSVG();
  };
  app.querySelectorAll("[data-share-record]").forEach(b => (b.onclick = () => openShare(b.dataset.shareRecord, "catalog")));
  const back = app.querySelector("[data-share-back]");
  if (back) back.onclick = () => shareAction("share-close");
}
function openShare(id, from) {
  state.selected = id; state.shareFrom = from; state.shareSentence = ""; state.shareOpts = shareDefaults();
  state.catalogDetail = null; state.view = "share"; render(true);
}
// Returns true when the action belonged to the share flow.
async function shareAction(a) {
  if (a === "share") { const r = currentRecord(); if (r) openShare(r.id, "record"); return true; }
  if (a === "share-close") {
    if (state.shareFrom === "catalog") { state.view = "history"; state.archiveTab = "catalog"; } else state.view = "entry";
    render(true); return true;
  }
  if (a === "share-link") {
    // No server, so there is no per-card link: the app address is copied.
    const link = location.href.split("#")[0];
    try {
      await navigator.clipboard.writeText(link);
      state.error = false; state.status = "앱 주소를 복사했어요. 카드별 링크는 아직 없어요."; showToast("앱 주소를 복사했어요");
    } catch { state.error = true; state.status = "앱 주소를 복사하지 못했어요. 주소창의 주소를 직접 복사해 주세요: " + link; }
    render(); return true;
  }
  if (a === "share-download" || a === "share-device" || a === "share-story") {
    if (state.busy) return true;
    state.busy = true; render();
    try {
      const record = shareRecord(), story = a === "share-story";
      const blob = story ? await svgToPNG(storySVG(), 1080, 1920) : await sharePNG();
      const fileName = `moment-${story ? "story" : "share"}-${record.recordDate}.png`;
      if ((story || a === "share-device") && canDeviceShare()) {
        try { await navigator.share({ files: [new File([blob], fileName, { type: "image/png" })], title: "오늘의 모먼트" }); state.status = "공유 창을 열었어요."; }
        catch (e) { if (e?.name !== "AbortError") throw e; state.status = "공유를 취소했어요."; }
      } else {
        downloadBlob(blob, fileName);
        state.status = story ? "스토리 이미지를 저장했어요. 인스타그램에서 스토리로 올려 주세요." : "공유 이미지 다운로드를 요청했어요.";
        if (story) showToast("스토리 이미지를 저장했어요");
      }
      state.error = false;
    } catch (e) { state.error = true; state.status = e.message; }
    finally { state.busy = false; render(); }
    return true;
  }
  return false;
}

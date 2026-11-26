// "New card" popup (2026-11-21, replaces the bottom badge; reference GIFs in reference/Gemini_*):
// a centered dialog with the best new card large (springy pop, gloss, sparkles, grade effects),
// the other new cards small, "내 감정 도감 보기" and "닫기". It stays until closed and always plays
// the same way. Unlocked slots are compared in memory only; nothing is added to the saved snapshot.
const seenSlots = { real: null, example: null };
let lastCardShown = null, lastCardEnterAt = 0;
function storeSettled() {
  try { return !loading && storeReady; } catch { return false; }
}
function celebrateUnlocks() {
  const mode = state.mode;
  // A held badge belongs to the draw on screen; once that draw is gone (another page), drop it.
  if (pendingCelebration && !drawPlaying()) pendingCelebration = null;
  if (mode === "real" && !storeSettled()) return;
  const keys = DiaryCards.unlockedKeys(activeRecords());
  // Real records: the first settled render is the baseline, so reloading never re-celebrates.
  if (mode === "real" && seenSlots.real === null) { seenSlots.real = keys; return; }
  const fresh = DiaryCards.newlyUnlocked(seenSlots[mode], keys);
  seenSlots[mode] = Array.from(new Set([...(seenSlots[mode] || []), ...keys]));
  if (fresh.length) playCelebration(fresh);
}
function cardEntrance() {
  const scene = app.querySelector(".flip-scene");
  const shown = scene ? state.mode + ":" + state.selected : null;
  // Rapid browsing (another card within 1.2s) skips the entrance so it does not repeat on every step.
  const now = Date.now();
  if (scene && shown !== lastCardShown && now - lastCardEnterAt > 1200) { scene.classList.add("card-enter"); lastCardEnterAt = now; }
  lastCardShown = shown;
}
// Short confirmation toast. The #feedback live region already announces the message,
// so the toast is hidden from assistive tech and never takes pointer events.
let toastTimer = 0;
function showToast(text) {
  let el = document.getElementById("moment-toast");
  if (!el) { el = document.createElement("div"); el.id = "moment-toast"; el.setAttribute("aria-hidden", "true"); document.body.append(el); }
  el.textContent = "✓ " + text;
  el.classList.remove("show"); void el.offsetWidth; el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 1800);
}
// While a card draw is playing, the badge waits for its result (it would cover the draw on phones and
// spoil the emotion before the burst). finish() in share-view.js flushes it; leaving the page drops it.
let pendingCelebration = null;
function drawPlaying() {
  return Boolean(document.querySelector(".card-box.is-sealed, .card-box.is-flipping"));
}
function flushCelebration() {
  const fresh = pendingCelebration;
  pendingCelebration = null;
  if (fresh && !drawPlaying()) playCelebration(fresh);
}
const CELEBRATE_MORE = 6;
function playCelebration(fresh) {
  if (drawPlaying()) { pendingCelebration = fresh; return; }
  // Another dialog (card modal, profile edit, card detail) keeps the screen: show the popup after it closes.
  const other = document.querySelector("dialog[open]:not(#celebrate-dialog)");
  if (other) {
    other.addEventListener("close", () => setTimeout(() => playCelebration(fresh)), { once: true });
    return;
  }
  // The highest stage leads (catalog order breaks ties); each key shows the first record in its slot
  // (slots hold record ids).
  const records = activeRecords(), slots = DiaryCards.collection(records).filter(s => s.records.length);
  const slotOf = key => slots.find(s => s.type + ":" + s.stage === key);
  const recordOf = key => records.find(r => r.id === slotOf(key).records[0]);
  const keys = fresh.filter(slotOf);
  if (!keys.length) return;
  const lead = keys.reduce((best, k) => (Number(k.split(":")[1]) > Number(best.split(":")[1]) ? k : best), keys[0]);
  const [type, stage] = lead.split(":"), name = CardexCore.type(type).name, rest = keys.filter(k => k !== lead);
  // Demo cards were never earned (critique 4: "27장 획득!" promised what real records cannot give yet).
  const title = state.mode === "example" ? (keys.length > 1 ? `시연 도감에 카드 ${keys.length}장이 담겨 있어요` : "시연 도감에 카드가 담겨 있어요")
    : keys.length > 1 ? `새로운 감정 카드 ${keys.length}장 획득!` : "새로운 감정 카드 획득!";
  const desc = `${E(name)} · ${stage}단계 카드가 도감에 채워졌어요.${rest.length ? ` 외 ${rest.length}장도 함께 담겼어요.` : ""}`;
  const count = [6, 8, 12][Math.min(2, Math.max(0, Number(stage) - 1))] || 6, step = 360 / count;
  const sparkles = Array.from({ length: count }, (_, i) => `<i style="--a:${Math.round(i * step + (i % 2 ? 12 : 0))}deg;--d:${(i % 3) * 26 + 120}px;--s:${(i % 4) * 2 + 6}px;--delay:${(i % 5) * 40}ms"></i>`).join("");
  const more = rest.slice(0, CELEBRATE_MORE).map(k => {
    const [t, s] = k.split(":");
    return `<li>${miniCard(recordOf(k))}<span class="sr-only">${E(CardexCore.type(t).name)} ${s}단계</span></li>`;
  }).join("") + (rest.length > CELEBRATE_MORE ? `<li class="celebrate-rest" aria-label="외 ${rest.length - CELEBRATE_MORE}장">+${rest.length - CELEBRATE_MORE}</li>` : "");
  const opener = document.activeElement;
  document.getElementById("celebrate-dialog")?.remove();
  const dialog = document.createElement("dialog");
  dialog.id = "celebrate-dialog";
  dialog.className = "moment-celebrate";
  dialog.dataset.grade = "stage-" + stage;
  dialog.dataset.emotion = type;
  dialog.style.setProperty("--tone", `var(--${type})`);
  dialog.setAttribute("aria-labelledby", "celebrate-title");
  dialog.setAttribute("aria-describedby", "celebrate-desc");
  dialog.innerHTML = `<div class="celebrate-panel">`
    + `<button type="button" class="icon celebrate-x" data-celebrate="close" aria-label="닫기"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6 6 18"/></svg></button>`
    + `<div class="celebrate-art" aria-hidden="true"><div class="celebrate-sparkles">${sparkles}</div><div class="celebrate-card">${miniCard(recordOf(lead))}<span class="celebrate-gloss"></span></div></div>`
    + `<div class="celebrate-copy"><p class="celebrate-eyebrow">${state.mode === "example" ? "시연 모드 · " : ""}MOMENT CARD</p>`
    + `<h2 id="celebrate-title">${title}</h2><p id="celebrate-desc" class="celebrate-desc">${desc}</p>`
    + (more ? `<ul class="celebrate-more" aria-label="함께 얻은 카드">${more}</ul>` : "")
    + `<div class="celebrate-actions"><button type="button" class="primary celebrate-go" data-celebrate="catalog">내 감정 도감 보기</button><button type="button" class="quiet celebrate-close" data-celebrate="close">닫기</button></div></div></div>`;
  document.body.append(dialog);
  let goCatalog = false;
  dialog.querySelectorAll("[data-celebrate]").forEach(b => b.onclick = () => { goCatalog = b.dataset.celebrate === "catalog"; dialog.close(); });
  // A click on the dimmed backdrop (the dialog box itself, outside the panel) closes it.
  dialog.addEventListener("click", e => { if (e.target === dialog) dialog.close(); });
  dialog.addEventListener("close", () => {
    dialog.remove();
    if (goCatalog) {
      Object.assign(state, { catalogType: type, catalogStage: Number(stage), catalogDetail: { type, stage: Number(stage) }, cardFilter: null, view: "history", archiveTab: "catalog" });
      render(true);
      return;
    }
    (opener?.isConnected ? opener : document.querySelector("header .avatar"))?.focus({ preventScroll: true });
  }, { once: true });
  dialog.showModal();
  dialog.querySelector(".celebrate-go").focus({ preventScroll: true });
}

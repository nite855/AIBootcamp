// "New card" moment, inspired by mymind's achievement badge: a soft, springy card
// pops up with a glossy sweep and a few sparkles, then drifts away on its own.
// It never blocks the page (pointer-events: none) and is skipped when card motion is off.
// Unlocked slots are compared in memory only; nothing is added to the saved snapshot.
const seenSlots = { real: null, example: null };
let lastCardShown = null, lastCardEnterAt = 0, celebrateTimer = 0;
// Hide the bottom tab bar while the on-screen keyboard shrinks the visual viewport.
if (typeof window !== "undefined" && window.visualViewport) {
  const syncKeyboard = () => document.documentElement.classList.toggle("keyboard-open", window.visualViewport.height < window.innerHeight * 0.75);
  window.visualViewport.addEventListener("resize", syncKeyboard);
}
function storeSettled() {
  try { return !loading && storeReady; } catch { return false; }
}
function celebrateUnlocks() {
  const mode = state.mode;
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
  if (scene && shown !== lastCardShown && now - lastCardEnterAt > 1200 && document.documentElement.dataset.motion !== "off") { scene.classList.add("card-enter"); lastCardEnterAt = now; }
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
function playCelebration(fresh) {
  if (document.documentElement.dataset.motion === "off") return;
  const [type, stage] = fresh[0].split(":"), t = CardexCore.type(type);
  const title = fresh.length > 1 ? `새 카드 ${fresh.length}장을 만났어요` : "새 카드를 만났어요";
  const sparkles = Array.from({ length: 6 }, (_, i) => `<i style="--a:${i * 60 + (i % 2 ? 12 : 0)}deg;--d:${(i % 3) * 18 + 62}px;--s:${(i % 4) * 2 + 5}px;--delay:${(i % 5) * 40}ms"></i>`).join("");
  document.querySelector(".moment-celebrate")?.remove();
  const el = document.createElement("div");
  el.className = "moment-celebrate";
  el.style.setProperty("--tone", `var(--${type})`);
  el.innerHTML = `<div class="celebrate-badge"><div class="celebrate-sparkles" aria-hidden="true">${sparkles}</div><div class="celebrate-card" aria-hidden="true">${characterSVG(type)}<span class="celebrate-gloss"></span></div><div class="celebrate-copy" role="status"><strong>${title}</strong><span>${E(t.name)} · ${stage}단계${fresh.length > 1 ? ` 외 ${fresh.length - 1}장` : ""}</span></div></div>`;
  document.body.append(el);
  clearTimeout(celebrateTimer);
  celebrateTimer = setTimeout(() => { el.classList.add("leaving"); setTimeout(() => el.remove(), 500); }, 3200);
}

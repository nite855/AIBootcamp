// Shared pointer light; the hit surface stays fixed while its artwork tilts.
function cardPointerLight(scene, tilt) {
  let frame = 0, point = null, bounds = null;
  function reset() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0; point = null; bounds = null;
    tilt.style.setProperty("--tilt-x", "0deg");
    tilt.style.setProperty("--tilt-y", "0deg");
    tilt.style.setProperty("--shine", "0");
  }
  function renderLight(e) {
    point = { x: e.clientX, y: e.clientY };
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (!point || !scene.isConnected) return;
      const r = bounds || (bounds = scene.getBoundingClientRect());
      if (!r.width || !r.height) return;
      const x = Math.max(0, Math.min(1, (point.x - r.left) / r.width));
      const y = Math.max(0, Math.min(1, (point.y - r.top) / r.height));
      tilt.style.setProperty("--tilt-x", ((.5 - y) * 18).toFixed(2) + "deg");
      tilt.style.setProperty("--tilt-y", ((x - .5) * 18).toFixed(2) + "deg");
      tilt.style.setProperty("--light-x", (x * 100).toFixed(1) + "%");
      tilt.style.setProperty("--rear-light-x", ((1 - x) * 100).toFixed(1) + "%");
      tilt.style.setProperty("--light-y", (y * 100).toFixed(1) + "%");
      tilt.style.setProperty("--shine", "1");
    });
  }
  return { reset, renderLight };
}
// One registry handles late dialogs, thumbnails and replacements without duplicate listeners.
const cardEffects = new Map();
const cardSelector = '.mini-card, .cm-art, .detail-card, .share-art-frame, .today-card, .empty-card, .mini-art:not(:has(.mini-card))';
function bindCardFoil(scene) {
  if (cardEffects.has(scene)) return cardEffects.get(scene).dispose;
  const controller = new AbortController(), signal = controller.signal;
  const tilt = scene.querySelector('.cm-tilt') || scene;
  const { reset, renderLight } = cardPointerLight(scene, tilt);
  tilt.classList.add('card-fx');
  const policy = scene.matches('.cm-art, .detail-card, .share-art-frame, .empty-card') ? 'detail' : 'list';
  scene.dataset.gesture = policy;
  tilt.dataset.gesture = policy;
  const grade = scene.matches('.mini-card') ? scene : scene.closest('[data-grade]');
  tilt.dataset.grade = grade?.dataset.grade || 'pending';
  if (grade?.dataset.emotion) tilt.dataset.emotion = grade.dataset.emotion;
  if (!tilt.querySelector(':scope > .card-fx-rim')) {
    const rim = document.createElement('span');
    rim.className = 'card-fx-rim'; rim.setAttribute('aria-hidden', 'true');
    tilt.append(rim);
  }
  if (!tilt.querySelector(':scope > .cm-light, :scope > .card-fx-light')) {
    const light = document.createElement('span');
    light.className = 'card-fx-light'; light.setAttribute('aria-hidden', 'true'); tilt.append(light);
  }
  let active = null, suppressTap = false;
  const listen = (type, fn, capture = false) => scene.addEventListener(type, fn, { signal, capture });
  const size = () => {
    tilt.style.setProperty('--fx-unit', scene.clientWidth / 100 + 'px');
    tilt.style.setProperty('--card-r', scene.clientWidth * 96 / 1080 + 'px');
  };
  size();
  let geometry = [scene.clientWidth, scene.clientHeight];
  const resize = new ResizeObserver(() => {
    const next = [scene.clientWidth, scene.clientHeight];
    if (next.some((value, i) => value !== geometry[i])) { if (active?.moved) suppressTap = true; stop(); geometry = next; size(); }
  }); resize.observe(scene);
  listen('pointerdown', e => {
    if (e.pointerType !== 'touch' || !e.isPrimary) return;
    suppressTap = false;
    active = { id: e.pointerId, x: e.clientX, y: e.clientY, time: performance.now(), moved: false, direction: null };
    renderLight(e);
  });
  listen('pointermove', e => {
    if (active?.id === e.pointerId) {
      const dx = Math.abs(e.clientX-active.x), dy = Math.abs(e.clientY-active.y);
      if (Math.hypot(dx,dy) > 8) {
        active.moved = true;
        active.direction ||= dx > dy ? 'tilt' : 'scroll';
      }
      if (policy === 'list' && active.direction === 'scroll') { reset(); return; }
    }
    if (e.pointerType === 'mouse' || e.pointerType === 'pen' || e.pointerId === active?.id) renderLight(e);
  });
  function stop() { active = null; reset(); }
  listen('pointerup', e => {
    if (active?.id === e.pointerId) suppressTap = active.moved || performance.now()-active.time >= 500;
    stop();
  });
  listen('pointercancel', () => { suppressTap = true; stop(); });
  listen('lostpointercapture', stop);
  listen('pointerleave', e => { if (e.pointerType !== 'touch') stop(); });
  listen('click', e => { if (e.detail && suppressTap) { e.preventDefault(); e.stopImmediatePropagation(); suppressTap = false; } }, true);
  const owner = scene.closest('button, [role="button"], [tabindex]');
  if (owner) {
    owner.addEventListener('pointerdown', () => { suppressTap = false; }, { signal, capture: true });
    owner.addEventListener('focus', () => { if (cardInput !== 'keyboard' || !owner.matches(':focus-visible')) return; tilt.style.setProperty('--light-x', '50%'); tilt.style.setProperty('--light-y', '50%'); tilt.style.setProperty('--shine', '1'); }, { signal });
    owner.addEventListener('blur', stop, { signal });
  }
  function dispose() { controller.abort(); resize.disconnect(); stop(); cardEffects.delete(scene); }
  cardEffects.set(scene, { dispose, reset: () => { if (active?.moved) suppressTap = true; stop(); } });
  return dispose;
}
function syncCardEffects() {
  for (const [scene, effect] of cardEffects) if (!scene.isConnected) effect.dispose();
  document.querySelectorAll(cardSelector).forEach(scene => {
    if (scene.closest('svg, .flip-scene') || scene.parentElement.closest(cardSelector)) return;
    if (scene.closest('dialog') && !scene.closest('dialog').open) return;
    bindCardFoil(scene);
  });
  document.querySelectorAll('.recent-panel, .catalog-head, .stats-head, .record-top, .share-preview, .card-detail .detail-info').forEach(region => {
    // Lists without a single open card (first-run catalog, empty or pending months) get no foil hint (2026-11-24).
    const list = region.closest('.catalog-page, .stats-page');
    if (list && !list.querySelector('.mini-card:not(.is-locked)')) { region.querySelector('.card-effect-hint')?.remove(); return; }
    if (region.querySelector('.card-effect-hint')) return;
    const hint = document.createElement('p'); hint.className = 'card-effect-hint'; region.append(hint);
  });
  updateCardHints();
}
let cardInput = matchMedia('(pointer: coarse)').matches ? 'touch' : 'mouse';
function updateCardHints() {
  const text = cardInput === 'touch' ? '카드를 터치하고 움직이면 포일이 반짝여요' : '카드 위에서 마우스를 움직이면 포일이 반짝여요';
  document.querySelectorAll('.card-effect-hint').forEach(hint => {
    const detail = hint.closest('.cm-stage, .detail-info, .share-preview, .record-top');
    const message = cardInput === 'touch' ? (detail ? '카드 위에서 움직이면 기울어져요 · 카드 바깥에서 스크롤하세요' : '좌우로 움직이면 포일이 반짝여요 · 위아래로 스크롤하세요') : text;
    if (hint.textContent !== message) hint.textContent = message;
  });
}
function trackCardInput(e) { const input = e.pointerType === 'touch' ? 'touch' : 'mouse'; if (input !== cardInput) { cardInput = input; updateCardHints(); } }
document.addEventListener('keydown', e => { if (['Tab','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) { cardInput = 'keyboard'; updateCardHints(); } });
document.addEventListener('pointerdown', trackCardInput, { passive: true });
document.addEventListener('pointermove', trackCardInput, { passive: true });
const resetCardEffects = () => { cardEffects.forEach(effect => effect.reset()); window.DiaryFlipReset?.(); };
window.addEventListener('cardex-theme-change', resetCardEffects);
window.addEventListener('blur', resetCardEffects);
window.addEventListener('resize', resetCardEffects);
// Height-only viewport changes (mobile browser chrome) must not cancel a card gesture.
let cardViewportWidth = innerWidth;
function resetOnWidthChange() { if (innerWidth !== cardViewportWidth) { cardViewportWidth = innerWidth; resetCardEffects(); } }
window.removeEventListener('resize', resetCardEffects);
window.addEventListener('resize', resetOnWidthChange);
document.addEventListener('scroll', resetCardEffects, true);
document.addEventListener('visibilitychange', resetCardEffects);
document.addEventListener('close', e => {
  for (const [scene, effect] of cardEffects) if (e.target.contains(scene)) effect.dispose();
}, true);
document.addEventListener('toggle', e => { if (e.target.matches('dialog[open]')) syncCardEffects(); }, true);
new MutationObserver(records => {
  // Counter animation and hint text changes do not need a full surface scan.
  if (records.some(record => [...record.addedNodes, ...record.removedNodes].some(node => node.nodeType === 1))) syncCardEffects();
}).observe(document.documentElement, { childList: true, subtree: true });
window.DiaryFlip = Object.freeze({ bindFoil: bindCardFoil, sync: syncCardEffects,
clearWithin(root) { if (root) for (const [scene, effect] of cardEffects) if (root.contains(scene)) effect.reset(); },
bind(app) {
window.DiaryFlipReset?.();
syncCardEffects();
window.DiaryFlipObserver?.disconnect();
const observer = new ResizeObserver(entries => entries.forEach(({target}) => {
  const scene = target.querySelector('.flip-scene');
  if (!scene) return;
  const width = Math.max(0, Math.min(320, target.clientWidth - 32));
  if (Math.abs(scene.clientWidth - width) > .5) window.DiaryFlipReset?.();
  scene.style.width = width + 'px';
  scene.style.height = width * 1.4 + 'px'; // 5:7 moment card (soft UI v1.1)
  scene.style.setProperty('--fx-unit', width / 100 + 'px');
}));
window.DiaryFlipObserver = observer;
app.querySelectorAll('.card-box').forEach(el => observer.observe(el));
const resets=[];
window.removeEventListener("cardex-theme-change",window.DiaryFlipReset);
window.DiaryFlipReset=()=>resets.forEach(reset=>reset());
window.addEventListener("cardex-theme-change",window.DiaryFlipReset);
window.removeEventListener("resize",window.DiaryFlipResizeReset);
window.DiaryFlipResizeReset=resetOnWidthChange;
window.addEventListener("resize",window.DiaryFlipResizeReset);
app.querySelectorAll(".flip-scene").forEach(scene=>{
      scene.dataset.gesture = 'detail';
      const tilt=scene.querySelector(".tilt-layer"), front=scene.querySelector(".flip-front"), rear=scene.querySelector(".flip-back");
      const frontButton=front.querySelector("button"), text=rear.querySelector(".flip-text");
      const rearRim = document.createElement('span'); rearRim.className = 'card-fx-rim'; rearRim.setAttribute('aria-hidden','true'); rear.append(rearRim);
      const effectsOff=()=>false; // card effects always run the same way (2026-11-20)
      let active=null, timer=0, suppressTap=false;
      const { reset, renderLight } = cardPointerLight(scene, tilt);
      // A gesture cut off by a scroll (the body text's own scroll included), resize or blur is never a tap:
      // without this, the pointerup found no gesture and the following click flipped the card (2026-11-24).
      resets.push(() => { clearHold(); if (active) suppressTap = true; active=null; reset(); });
      scene.addEventListener('focusin', e => {
        if (!e.target.matches(':focus-visible') || e.target.closest('.flip-text')) return;
        tilt.style.setProperty('--light-x','50%'); tilt.style.setProperty('--light-y','50%'); tilt.style.setProperty('--shine','1');
      });
      scene.addEventListener('focusout', reset);
      // Grade pulse (grade-effects.css): restart a one-shot burst around the card on every turn.
      function pulse(){const box=scene.closest(".card-box[data-grade]");if(!box||effectsOff())return;box.classList.remove("grade-pulse");void box.offsetWidth;box.classList.add("grade-pulse");}
      function clearHold(){if(timer)clearTimeout(timer);timer=0;}
      function flip(back){clearHold();reset();pulse();scene.classList.toggle("flipped",back);front.setAttribute("aria-hidden",String(back));rear.setAttribute("aria-hidden",String(!back));rear.inert=!back;front.inert=back;frontButton.tabIndex=back?-1:0;rear.tabIndex=back?0:-1;text.tabIndex=back?0:-1;(back?rear:frontButton).focus({preventScroll:true});}
      function selectedText(){const s=window.getSelection();return Boolean(s && !s.isCollapsed && (rear.contains(s.anchorNode)||rear.contains(s.focusNode)));}
      frontButton.addEventListener("click",e=>{if(e.detail!==0 && suppressTap){suppressTap=false;return;}flip(true);});
      rear.addEventListener("click",e=>{if(e.target.closest("button"))return;if((e.detail!==0 && suppressTap)||selectedText()){suppressTap=false;return;}flip(false);});
      rear.addEventListener("keydown",e=>{if(e.target===rear && (e.key==="Enter"||e.key===" ")){e.preventDefault();flip(false);}});
      scene.addEventListener("pointerdown",e=>{
        if(e.pointerType!=="touch"||!e.isPrimary)return;
        clearHold();reset();suppressTap=false;
        active={id:e.pointerId,x:e.clientX,y:e.clientY,moved:false,held:false,body:!!e.target.closest(".flip-text"),scrollTop:text.scrollTop};
        // Keep native touch events on the face while the artwork tilts beneath the finger.
        if(!active.body && e.target.hasPointerCapture(e.pointerId)){
          (scene.classList.contains("flipped")?rear:frontButton).setPointerCapture(e.pointerId);
        }
        if(!active.body){renderLight(e);const gesture=active;timer=setTimeout(()=>{timer=0;if(active===gesture)gesture.held=true;},500);}
      });
      scene.addEventListener("pointermove",e=>{
        if((e.pointerType==="mouse"||e.pointerType==="pen")){renderLight(e);return;}
        if(e.pointerType!=="touch"||!active||active.id!==e.pointerId)return;
        if(Math.hypot(e.clientX-active.x,e.clientY-active.y)>8){active.moved=true;if(!active.held)clearHold();}
        if(!active.body)renderLight(e);
      });
      scene.addEventListener("pointerup",e=>{
        if(e.pointerType!=="touch"||!active||active.id!==e.pointerId)return;
        suppressTap=active.held||active.moved||text.scrollTop!==active.scrollTop;
        clearHold();active=null;reset();
      });
      scene.addEventListener("pointercancel",e=>{if(active&&active.id===e.pointerId){suppressTap=true;active=null;}clearHold();reset();});
      scene.addEventListener("pointerleave",e=>{if(e.pointerType==="mouse")reset();});
      scene.addEventListener("contextmenu",e=>{if(active && !active.body)e.preventDefault();});
    });
} });

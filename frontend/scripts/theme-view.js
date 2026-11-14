// Previews are isolated from saved appearance until Apply is pressed.
let galleryMode = "light", previewTheme = null, galleryFilter = "all";
const modeName = mode => ({ light: "라이트", dark: "다크" })[mode];
const previewMode = () => galleryMode;
function themeScene(id) {
  return themeScenes[id] ? `<img class="theme-scenery" src="${themeScenes[id]}" alt="">` : '<span class="theme-scenery abstract-scenery" aria-hidden="true">✦</span>';
}
function themeSample(id, large = false, mode = galleryMode) {
  return `<div class="theme-preview ${large ? "large-preview" : ""}" data-appearance="${id}" data-theme="${mode}" aria-hidden="true"><div class="sample-banner">${themeScene(id)}<span>오늘의 모먼트</span><strong>작은 하루를 모아요</strong></div><div class="sample-body"><div class="sample-paper"><small>11월 14일 · 오늘</small><strong>산책길에 만난 작은 행복</strong><p>따뜻한 바람과 좋아하는 음악.<br>오늘도 나만의 속도로 걸었어요.</p></div><div class="sample-paper sample-secondary"><small>나의 최근 기록</small><p>마음에 남은 순간을 기록해요.</p></div><span class="sample-action">기록 남기기</span></div></div>`;
}
function themeSettingsRow() {
  const selected = CardexTheme.themes.find(t => t.id === CardexTheme.getTheme());
  return `<fieldset><legend>화면 테마</legend><button type="button" class="theme-settings-link" data-action="theme-gallery"><span class="theme-chip" data-appearance="${selected.id}" aria-hidden="true">${themeScene(selected.id)}</span><span><strong>${E(selected.name)}</strong><small>${modeName(CardexTheme.getPreference())} · 테마 둘러보기</small></span><span aria-hidden="true">›</span></button></fieldset>`;
}
function themeGallery() {
  const variants = CardexTheme.themes.flatMap(t => ['light','dark'].map(mode => ({...t,mode})));
  return `<section class="panel theme-gallery"><div class="row"><h1>나의 하루에 어울리는 테마</h1>${btn('theme-back','설정으로')}</div><p id="theme-current" role="status"></p><nav class="gallery-filters" aria-label="테마 분류">${[['all','전체'],['light','라이트'],['dark','다크']].map(([id,name])=>`<button type="button" data-theme-filter="${id}" aria-pressed="${galleryFilter===id}">${name}</button>`).join('')}</nav><div class="theme-gallery-grid">${variants.filter(t=>galleryFilter==='all'||t.mode===galleryFilter).map(t=>`<button type="button" class="theme-tile" data-theme-preview="${t.id}" data-mode="${t.mode}" aria-label="${E(t.name)} ${modeName(t.mode)} 미리보기" aria-haspopup="dialog">${themeSample(t.id,false,t.mode)}<span class="theme-tile-label"><strong>${E(t.name)} · ${modeName(t.mode)}</strong></span></button>`).join('')}</div></section>`;
}
function syncThemeSettings() {
  const row = app.querySelector(".theme-settings-link");
  if (!row) return;
  const selected = CardexTheme.themes.find(t => t.id === CardexTheme.getTheme());
  row.querySelector("strong").textContent = selected.name;
  row.querySelector("small").textContent = `${modeName(CardexTheme.getPreference())} · 테마 둘러보기`;
  const chip = row.querySelector(".theme-chip");
  chip.dataset.appearance = selected.id;
  chip.innerHTML = themeScene(selected.id);
}
function themePreviewDialog() {
  return '<dialog id="theme-dialog" class="theme-dialog" aria-labelledby="theme-dialog-title"><div class="theme-dialog-head"><h2 id="theme-dialog-title"></h2><button type="button" class="quiet" data-close-theme>닫기</button></div><div id="theme-dialog-sample"></div><div class="theme-dialog-footer"><p class="muted">예시 화면 · 적용 전에는 설정이 바뀌지 않아요.</p><button type="button" class="primary" data-apply-theme>이 테마 적용</button></div></dialog>';
}
function bindThemeGallery() {
  syncThemePreviews();
  const dialog = app.querySelector("#theme-dialog");
  app.querySelectorAll('[data-theme-filter]').forEach(b=>b.onclick=()=>{galleryFilter=b.dataset.themeFilter;render();app.querySelector(`[data-theme-filter="${galleryFilter}"]`).focus();});
  app.querySelectorAll("[data-theme-preview]").forEach(button => button.addEventListener("click", () => {
    previewTheme = button.dataset.themePreview;
    galleryMode = button.dataset.mode;
    dialog.querySelector("#theme-dialog-title").textContent = CardexTheme.themes.find(t => t.id === previewTheme).name + " · " + modeName(galleryMode);
    dialog.querySelector("#theme-dialog-sample").innerHTML = themeSample(previewTheme, true);
    const apply = dialog.querySelector('[data-apply-theme]');
    const current = previewTheme===CardexTheme.getTheme() && galleryMode===CardexTheme.getPreference();
    apply.disabled=current; apply.textContent=current?'현재 적용 중':'이 테마 적용';
    dialog.addEventListener("close", () => { previewTheme = null; button.focus({preventScroll:true}); }, { once: true });
    dialog.showModal();
  }));
  dialog?.querySelector("[data-close-theme]").addEventListener("click", () => dialog.close());
  dialog?.querySelector("[data-apply-theme]").addEventListener("click", () => {
    if (!previewTheme || (previewTheme===CardexTheme.getTheme() && galleryMode===CardexTheme.getPreference())) return;
    CardexTheme.setTheme(previewTheme);
    CardexTheme.set(galleryMode);
    dialog.close();
    app.querySelector('#theme-current').textContent += ' · 적용했어요';
    document.getElementById("announcer").textContent = "선택한 테마와 화면 모드를 적용했어요.";
  });
}
function syncThemePreviews() {
  app.querySelectorAll('.applied-badge').forEach(el=>el.remove());
  app.querySelectorAll('[data-theme-preview]').forEach(b=>{
    const applied=b.dataset.themePreview===CardexTheme.getTheme() && b.dataset.mode===CardexTheme.getPreference();
    b.dataset.applied=String(applied);
    if(applied)b.querySelector('.theme-tile-label').insertAdjacentHTML('beforeend','<span class="applied-badge">✓ 적용 중</span>');
  });
  const status=app.querySelector('#theme-current');
  if(status)status.textContent='현재 적용: '+CardexTheme.themes.find(t=>t.id===CardexTheme.getTheme()).name+' · '+modeName(CardexTheme.getPreference());
}

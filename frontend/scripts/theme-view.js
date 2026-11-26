// Settings swatches open an isolated preview; nothing changes until Apply is pressed.
let galleryMode = "light", previewTheme = null;
const modeName = mode => ({ light: "라이트", dark: "다크" })[mode];
function themeScene(id) {
  return themeScenes[id] ? `<img class="theme-scenery" src="${themeScenes[id]}" alt="">` : '<span class="theme-scenery abstract-scenery" aria-hidden="true">✦</span>';
}
function themeSample(id, large = false, mode = galleryMode) {
  return `<div class="theme-preview ${large ? "large-preview" : ""}" data-appearance="${id}" data-theme="${mode}" aria-hidden="true"><div class="sample-banner">${themeScene(id)}<span>오늘의 모먼트</span><strong>작은 하루를 모아요</strong></div><div class="sample-body"><div class="sample-paper"><small>11월 14일 · 오늘</small><strong>산책길에 만난 작은 행복</strong><p>따뜻한 바람과 좋아하는 음악.<br>오늘도 나만의 속도로 걸었어요.</p></div><div class="sample-paper sample-secondary"><small>나의 최근 기록</small><p>마음에 남은 순간을 기록해요.</p></div><span class="sample-action">기록 남기기</span></div></div>`;
}
function themePreviewDialog() {
  return '<dialog id="theme-dialog" class="theme-dialog" aria-labelledby="theme-dialog-title"><div class="theme-dialog-head"><h2 id="theme-dialog-title"></h2><button type="button" class="quiet" data-close-theme>닫기</button></div><div id="theme-dialog-sample"></div><div class="theme-dialog-footer"><p class="muted">예시 화면 · 적용 전에는 설정이 바뀌지 않아요.</p><button type="button" class="primary" data-apply-theme>이 테마 적용</button></div></dialog>';
}
function bindThemeGallery() {
  const dialog = app.querySelector("#theme-dialog");
  app.querySelectorAll("[data-theme-preview]").forEach(button => button.addEventListener("click", () => {
    previewTheme = button.dataset.themePreview;
    galleryMode = button.dataset.mode;
    dialog.querySelector("#theme-dialog-title").textContent = CardexTheme.themes.find(t => t.id === previewTheme).name + " · " + modeName(galleryMode);
    dialog.querySelector("#theme-dialog-sample").innerHTML = themeSample(previewTheme, true);
    const apply = dialog.querySelector('[data-apply-theme]');
    const current = previewTheme===CardexTheme.getTheme() && galleryMode===CardexTheme.getPreference();
    apply.disabled=current; apply.textContent=current?'현재 적용 중':'이 테마 적용';
    const theme = previewTheme;
    dialog.addEventListener("close", () => { previewTheme = null; app.querySelector(`[data-theme-preview="${theme}"]`)?.focus({preventScroll:true}); }, { once: true });
    dialog.showModal();
  }));
  dialog?.querySelector("[data-close-theme]").addEventListener("click", () => dialog.close());
  dialog?.querySelector("[data-apply-theme]").addEventListener("click", () => {
    if (!previewTheme || (previewTheme===CardexTheme.getTheme() && galleryMode===CardexTheme.getPreference())) return;
    CardexTheme.setTheme(previewTheme);
    CardexTheme.set(galleryMode);
    dialog.close();
    // Redraw the settings swatches so the check mark follows the applied theme.
    if (state.view === "settings") render();
    document.getElementById("announcer").textContent = "선택한 테마를 적용했어요.";
  });
}

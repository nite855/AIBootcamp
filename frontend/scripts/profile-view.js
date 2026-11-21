// Soft UI v1.1 profile and settings page (Figma "프로필 · 설정" 2077:13884 / mobile 2077:14212,
// 2026-11-21 F7). Opened from the avatar. Left: 240 profile card (avatar, nickname, days together,
// records / cards / streak, edit) and a panel-less "설정" menu. Right: the theme panel and one prefs
// panel (알림 · 시연 모드 · 모든 기록 삭제 · 앱 정보). Included inside the app closure with the other views.
const profileStorage = (() => { try { return window.localStorage; } catch { return null; } })();
let profile = MomentProfile.load(profileStorage);
let profileSection = "theme"; // menu item shown as selected (Figma: white pill)
const PROFILE_SECTIONS = [["theme", "테마"], ["notice", "알림"], ["records", "기록"], ["data", "데이터"], ["about", "정보"]];
function profileStats() {
  const real = state.sessions, first = real.map(r => r.recordDate).sort()[0];
  return {
    records: real.length,
    cards: DiaryCards.collection(real).filter(s => s.records.length).length,
    streak: DiaryStatistics.streakDays(real.map(r => r.recordDate), localDate()),
    days: MomentProfile.daysTogether(first, localDate()),
  };
}
function profilePanel() {
  const s = profileStats();
  const swatches = CardexTheme.themes.map(t => {
    const [paper, surface, ink, , accent, , tint] = t.colors;
    const current = t.id === CardexTheme.getTheme();
    return `<button type="button" class="theme-swatch" data-theme-id="${t.id}" aria-current="${current}"><span class="swatch-thumb" aria-hidden="true" style="--sw-paper:${paper};--sw-surface:${surface};--sw-ink:${ink};--sw-accent:${accent};--sw-tint:${tint}"><i></i><i></i><i></i><i class="sw-bar"></i><i class="sw-lines"></i></span><span class="swatch-radio" aria-hidden="true"></span><span class="theme-tile-label"><strong>${E(t.name)}</strong><small>${E(t.description)}</small></span></button>`;
  }).join("");
  // Figma prefs panel: one row per setting, a hairline between rows.
  const pref = (title, sub, control, extra = "") => `<div class="pref-row"${extra}><span class="pref-text"><strong>${title}</strong><small>${sub}</small></span>${control}</div>`;
  const notice = (key, title, sub) => `<label class="switch-row pref-row notice-row"><span class="pref-text"><strong>${title}</strong><small>${sub}</small></span><input type="checkbox" role="switch" data-notice="${key}" ${profile[key] ? "checked" : ""}></label>`;
  const group = (id, title, body) => `<div class="pref-group" id="settings-${id}" aria-labelledby="${id}-title" role="group"><h2 id="${id}-title" class="sr-only" tabindex="-1">${title}</h2>${body}</div>`;
  const card = `<section class="panel profile-card" aria-labelledby="profile-name"><span class="profile-avatar" style="--avatar:${profile.color}" aria-hidden="true">${profileIcon(profile.icon)}</span><div class="profile-who"><h3 id="profile-name">${E(profile.name)}</h3><p class="profile-days">${s.days ? `moment와 함께한 지 ${s.days}일째` : "첫 기록을 남기면 함께한 날을 세어 드려요"}</p></div><dl class="profile-stats"><div><dt>기록</dt><dd>${s.records}</dd></div><div><dt>카드</dt><dd>${s.cards}</dd></div><div><dt>연속</dt><dd>${s.streak}일</dd></div></dl><button type="button" class="secondary" data-profile-edit aria-haspopup="dialog" aria-label="프로필 편집"><span class="wide-only">프로필 편집</span><span class="narrow-only" aria-hidden="true">편집 ›</span></button></section>`;
  const nav = `<nav class="profile-nav" aria-labelledby="profile-nav-label"><p class="profile-nav-label" id="profile-nav-label">설정</p>${PROFILE_SECTIONS.map(([id, label]) => `<button type="button" class="profile-jump" data-profile-jump="${id}"${id === profileSection ? ' aria-current="true"' : ""}>${label}</button>`).join("")}</nav>`;
  const deleteLabel = state.clearAllConfirm ? "정말 삭제" : "삭제";
  return `<section class="settings-panel settings-page profile-page" aria-labelledby="profile-title"><div class="profile-head page-heading"><h2 id="profile-title" class="profile-title">프로필</h2>${state.mode === "example" ? '<p class="profile-mode">시연 모드 · 숫자는 실제 기록 기준이에요</p>' : ""}</div>
    <div class="profile-grid"><aside class="profile-side">${card}${nav}</aside><div class="profile-main">
    <section class="panel settings-col" id="settings-theme" aria-labelledby="theme-title"><div class="settings-col-head"><h2 id="theme-title" tabindex="-1">테마</h2><p>다이어리의 분위기를 바꿀 수 있어요. 카드 색은 그대로 유지돼요.</p></div><div class="theme-swatches">${swatches}</div></section>
    <section class="panel prefs-panel" aria-label="설정">
    ${group("notice", "알림", notice("notifyDaily", "매일 기록 알림", "오후 9:00에 오늘의 기록을 알려드려요") + notice("notifyAnalysis", "카드 분석 완료 알림", "카드가 열리면 알려드려요") + '<p class="notice-note">이 기기에서는 아직 알림을 보낼 수 없어요. 설정만 저장해 두었다가 알림이 준비되면 사용해요.</p>')}
    ${group("records", "기록", `<label class="switch-row pref-row"><span class="pref-text"><strong>시연 모드</strong><small>합성 데이터로 화면을 보여줘요 · 실제 기록과 섞이지 않아요</small></span><input type="checkbox" role="switch" data-action="preview" ${state.mode === "example" ? "checked" : ""}></label>`)}
    ${group("data", "데이터", pref("모든 기록 삭제", "기록은 이 브라우저에만 보관돼요. 계정·동기화·서버 백업은 없어요", btn("delete-all", deleteLabel, "secondary danger", `aria-label="${state.clearAllConfirm ? "정말 모든 기록 삭제" : "모든 기록 삭제"}"`)))}
    ${group("about", "정보", pref("앱 정보 · 글꼴 라이선스", 'AI 감정 분석은 아직 연결 전이라 실제 기록은 "분석 대기"로 보여요 · Gothic A1, Bricolage Grotesque (SIL OFL)', '<button type="button" class="secondary" data-profile-action="license" aria-haspopup="dialog">라이선스 보기</button>'))}
    </section>
    </div></div>
    <dialog id="profile-dialog" class="read-dialog profile-dialog" aria-labelledby="profile-dialog-title"><form method="dialog"><h2 id="profile-dialog-title">프로필 편집</h2><label class="profile-field" for="profile-name-input">닉네임 <small class="muted">최대 ${MomentProfile.NAME_MAX}자</small><input id="profile-name-input" type="text" maxlength="${MomentProfile.NAME_MAX * 2}" value="${E(profile.name)}" autocomplete="nickname"></label><fieldset class="profile-icons"><legend>아이콘</legend>${MomentProfile.ICONS.map(id => `<label class="icon-option"><input type="radio" name="profile-icon" value="${id}" ${id === profile.icon ? "checked" : ""}><span style="--avatar:${profile.color}" aria-hidden="true">${profileIcon(id)}</span><span class="sr-only">${MomentProfile.ICON_LABELS[id]}</span></label>`).join("")}</fieldset><fieldset class="profile-colors"><legend>아바타 색</legend>${MomentProfile.COLORS.map((c, i) => `<label class="color-option"><input type="radio" name="profile-color" value="${c}" ${c === profile.color ? "checked" : ""}><span style="--avatar:${c}" aria-hidden="true">${profileIcon(profile.icon)}</span><span class="sr-only">색 ${i + 1}</span></label>`).join("")}</fieldset><div class="row"><button type="button" class="quiet" data-profile-cancel>취소</button><button type="submit" class="primary" value="save">저장</button></div></form></dialog></section>`;
}
function bindProfile() {
  if (state.view !== "settings") return;
  app.querySelectorAll("[data-profile-jump]").forEach(b => b.onclick = () => {
    profileSection = b.dataset.profileJump;
    app.querySelectorAll("[data-profile-jump]").forEach(x => x.removeAttribute("aria-current"));
    b.setAttribute("aria-current", "true");
    const section = app.querySelector(`#settings-${b.dataset.profileJump}`);
    section?.scrollIntoView({ block: "start" });
    section?.querySelector("h2")?.focus({ preventScroll: true });
  });
  app.querySelectorAll("[data-notice]").forEach(input => input.onchange = () => {
    const result = MomentProfile.save(profileStorage, { ...profile, [input.dataset.notice]: input.checked });
    profile = result.profile;
    document.getElementById("announcer").textContent = result.stored ? "알림 설정을 저장했어요. 실제 알림은 아직 보내지 않아요." : "이 브라우저에 설정을 저장하지 못했어요.";
  });
  const dialog = app.querySelector("#profile-dialog");
  const opener = app.querySelector("[data-profile-edit]");
  if (opener && dialog) opener.onclick = () => {
    dialog.showModal();
    dialog.querySelector("#profile-name-input").select();
  };
  // Live previews: icon options wear the chosen color, color options show the chosen icon.
  const syncPreviews = () => {
    const icon = dialog.querySelector("[name=profile-icon]:checked")?.value;
    const color = dialog.querySelector("[name=profile-color]:checked")?.value;
    dialog.querySelectorAll(".icon-option span[aria-hidden]").forEach(s => s.style.setProperty("--avatar", color || profile.color));
    dialog.querySelectorAll("[name=profile-color] + span").forEach(s => { s.innerHTML = profileIcon(icon); });
  };
  dialog?.addEventListener("change", e => { if (/^profile-(icon|color)$/.test(e.target.name)) syncPreviews(); });
  dialog?.querySelector("[data-profile-cancel]")?.addEventListener("click", () => dialog.close());
  dialog?.addEventListener("close", () => {
    if (dialog.returnValue === "save") {
      const name = dialog.querySelector("#profile-name-input").value;
      const color = dialog.querySelector("[name=profile-color]:checked")?.value;
      const icon = dialog.querySelector("[name=profile-icon]:checked")?.value;
      const result = MomentProfile.save(profileStorage, { ...profile, name, color, icon });
      profile = result.profile;
      render();
      document.getElementById("announcer").textContent = result.stored ? "프로필을 저장했어요." : "이 브라우저에 프로필을 저장하지 못했어요. 새로고침하면 사라져요.";
    }
    app.querySelector("[data-profile-edit]")?.focus({ preventScroll: true });
  });
  app.querySelector('[data-profile-action="license"]')?.addEventListener("click", e => {
    openInfo("글꼴 라이선스", document.getElementById("embedded-font-license")?.textContent || "", e.currentTarget);
  });
}

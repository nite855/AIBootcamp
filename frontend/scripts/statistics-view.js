function archivePanel() {
  let body;
  if (state.archiveTab === "stats") body = statisticsPanel();
  else if (state.archiveTab === "catalog") body = catalogPanel();
  else {
    const records = repository.query({ date: state.dateFilter }).filter(r => (!state.favoritesOnly || r.favorite) && r.text.toLocaleLowerCase().includes(state.search.toLocaleLowerCase()));
    const count = 6;
    const pages = Math.max(1, Math.ceil(records.length / count));
    state.page = Math.min(state.page, pages - 1);
    body = `<p class="muted">${state.mode === "example" ? "예시 모드 · 내 기록과 분리" : "내 기록 · 이 브라우저에 보관"}</p>${state.dateFilter ? `<div class="row"><span>${state.dateFilter}</span>${btn("clear-date", "날짜 필터 해제")}</div>` : ""}<div class="search-controls"><label for="record-search">기록 검색</label><input id="record-search" type="search" placeholder="기억나는 단어로 찾아보세요" value="${E(state.search)}"><details class="record-filters"><summary>필터${state.favoritesOnly || state.dateFilter ? " · 적용 중" : ""}</summary><label class="favorite-filter"><input id="favorites-only" type="checkbox" ${state.favoritesOnly ? "checked" : ""}>즐겨찾기만</label></details>${state.search || state.favoritesOnly || state.dateFilter || state.cardFilter ? btn("reset-search","필터 초기화") : ""}</div><p class="muted" role="status">${records.length}편의 기록</p><div class="entry-list">${
      records
        .slice(state.page * count, (state.page + 1) * count)
        .map(recordRow)
        .join("") || `<p>${state.dateFilter ? "이 날짜에는 기록이 없어요." : state.cardFilter ? "이 캐릭터와 연결된 기록이 없어요." : (state.search || state.favoritesOnly ? "조건에 맞는 기록이 없어요. 필터를 바꿔 보세요." : "아직 기록이 없어요. 오늘의 첫 문장을 남겨 보세요.")}</p>`
    }</div><div class="pagination" ${pages === 1 && !state.dateFilter && !state.cardFilter ? "hidden" : ""}>${pages > 1 ? btn("prev", "이전", "quiet", state.page === 0 ? "disabled" : "") + `<span>${state.page + 1} / ${pages}</span>` + btn("next", "다음", "quiet", state.page === pages - 1 ? "disabled" : "") : ""}${state.dateFilter ? btn("back-stats", "통계로") : ""}</div>`;
  }
  return `<section class="panel archive-panel"><div class="row"><h2>${state.archiveTab === "stats" ? "돌아보기" : state.archiveTab === "catalog" ? "캐릭터 도감" : "지난 기록"}</h2></div>${body}</section>`;
}
function statisticsPanel() {
  const stats = DiaryStatistics.monthSummary(
    repository.query({ month: state.month }),
    state.month,
  );
  const available =
    state.statsTab === "trend"
      ? stats.days.filter((x) => x.summary.validCount)
      : stats.days;
  if (!available.some((x) => x.date === state.statsDate))
    state.statsDate = available.at(-1)?.date || "";
  const selected = stats.days.find((x) => x.date === state.statsDate);
  const controls = `<div class="month-controls"><label>월 <input id="stats-month" type="month" value="${state.month}" max="${localDate().slice(0,7)}"></label><label>통계 <select id="stats-kind">${[["trend","감정 추이"],["count","월간 기록"],["distribution","감정 분포"]].map(([id,label])=>`<option value="${id}" ${state.statsTab === id ? "selected" : ""}>${label}</option>`).join("")}</select></label></div>`;
  if (state.statsTab === "count") {
    const first = new Date(state.month + '-01T12:00:00').getDay();
    const days = stats.days;
    const totalDays = new Date(Number(state.month.slice(0,4)),Number(state.month.slice(5,7)),0).getDate();
    const cells = Array.from({length:totalDays},(_,i)=> {
      const date = `${state.month}-${String(i+1).padStart(2,'0')}`;
      const day = days.find(d=>d.date===date), count = day?.count || 0;
      return `<button class="calendar-day ${count ? 'has-records' : ''}" data-month-date="${date}" aria-label="${date}, 기록 ${count}편"><strong>${i+1}</strong><span>${count ? count+'편' : '·'}</span></button>`;
    });
    return `${controls}<div class="month-summary"><strong>${stats.total}편의 기록</strong><span>${days.filter(d=>d.count).length}일의 순간</span></div><p class="muted">날짜를 누르면 그날의 글을 읽을 수 있어요. 미분석 기록에는 감정 색을 붙이지 않아요.</p><div class="calendar-grid">${['일','월','화','수','목','금','토'].map(d=>`<span class="weekday">${d}</span>`).join('')}${'<span aria-hidden="true"></span>'.repeat(first)}${cells.join('')}</div>`;
  }
  let graph = "";
  if (!stats.total)
    graph = `<div class="stats-empty"><p>아직 이 달의 기록이 없어요.</p>${btn("archive-records", "지난 기록 보기")}</div>`;
  else if (state.statsTab !== "count" && !stats.valid)
    graph = `<div class="stats-empty"><p>감정 분석은 준비 중이에요. 기록은 보관함에서 읽을 수 있어요.</p>${btn("archive-records", "지난 기록 보기")}</div>`;
  else if (state.statsTab === "distribution")
    graph = `<div class="distribution" aria-label="분석된 기록의 평균 분류 확률">${CardexCore.PARENTS.map(p => `<section class="distribution-group" aria-label="${p.name}"><h3>${p.name}<span>${CardexCore.percent(stats.distribution.parents[p.id])}</span></h3>${p.children.map(id => {
      const t = CardexCore.type(id), value = stats.distribution.leaf[id];
      return `<div class="distribution-row"><span>${t.name}</span><div><i style="width:${value * 100}%;background:var(--${id})"></i></div><strong>${CardexCore.percent(value)}</strong></div>`;
    }).join("")}</section>`).join("")}</div><p class="muted">분석된 기록의 평균 분류 확률이에요. 중립에는 객관적 서술·의문·놀람·당황을 포함해요.</p>`;
  else {
    const x = (i) => 42 + (i * 640) / (stats.days.length - 1),
      y = (v) => 185 - v * 150;
    let marks = "";
    for (const value of [0, 0.5, 1])
      marks += `<path d="M42 ${y(value)}H690" stroke="var(--line)"/><text x="34" y="${y(value) + 4}" text-anchor="end">${state.statsTab === "count" ? Math.round(value * Math.max(1, ...stats.days.map((d) => d.count))) : value * 100 + "%"}</text>`;
    if (state.statsTab === "count") {
      const max = Math.max(1, ...stats.days.map((d) => d.count));
      stats.days.forEach((d, i) => {
        marks += `<rect x="${x(i) - 6}" y="${y(d.count / max)}" width="12" height="${185 - y(d.count / max)}" fill="var(--blue)"/>`;
      });
    } else
      CardexCore.PARENTS.forEach((p, index) => {
        let previous = null;
        stats.days.forEach((d, i) => {
          if (!d.summary.validCount) {
            previous = null;
            return;
          }
          const point = [x(i), y(d.summary.parents[p.id])];
          if (previous)
            marks += `<path d="M${previous.join(" ")}L${point.join(" ")}" fill="none" stroke="var(--${p.id})" stroke-width="3" stroke-dasharray="${["0", "7 4", "2 4"][index]}"/>`;
          marks += `<circle cx="${point[0]}" cy="${point[1]}" r="4" fill="var(--${p.id})"/>`;
          previous = point;
        });
      });
    stats.days.forEach((d, i) => {
      if (i === 0 || i === stats.days.length - 1 || (i + 1) % 5 === 0)
        marks += `<text x="${x(i)}" y="211" text-anchor="middle">${i + 1}일</text>`;
    });
    graph = `<svg class="stats-chart" viewBox="0 0 720 225" role="img" aria-label="${state.statsTab === "count" ? "날짜별 기록 편수" : "날짜별 감정 비중, 기록 없는 구간은 공백"}">${marks}</svg>${state.statsTab === "trend" ? `<div class="stats-legend">${CardexCore.PARENTS.map((p, i) => `<span style="color:var(--${p.id})">${["━", "┄", "┈"][i]} ${p.name}</span>`).join("")}</div>` : ""}`;
  }
  const details = selected
    ? `${selected.count}편${selected.summary.validCount ? " · " + CardexCore.PARENTS.map((p) => p.name + " " + CardexCore.percent(selected.summary.parents[p.id])).join(" · ") : " · 감정 분석 없음"}`
    : "";
  return `${controls}<p class="muted">${state.mode === "example" ? "예시 통계 · 실제 사용자 분석 아님" : "내 기록 통계 · 감정 분석은 준비 중"}</p><div class="stats-summary">기록 <strong>${stats.total}</strong>편 · 작성한 날 <strong>${stats.writtenDays}</strong>일<br><small>분석 ${stats.valid}편 · 미분석 ${stats.missing}편${state.statsTab === "trend" && stats.days.filter((x) => x.summary.validCount).length === 1 ? " · 비교할 날짜가 더 필요해요." : ""}</small></div><div class="graph-space${state.statsTab === "distribution" ? " distribution-space" : ""}"${state.statsTab === "distribution" ? ' tabindex="0" role="region" aria-label="감정 분포 상세"' : ""}>${graph}</div>${state.statsTab !== "distribution" && available.length ? `<div class="stats-detail"><label>날짜 <select id="stats-date">${available.map((d) => `<option value="${d.date}" ${d.date === state.statsDate ? "selected" : ""}>${d.date}</option>`).join("")}</select></label>${btn("date-records", "기록 보기")}<p>${E(details)}</p></div>` : '<p class="muted">감정 비중은 감정의 강도나 심리 점수가 아니에요.</p>'}`;
}
function bindStatistics() {
  app.querySelector('#stats-kind')?.addEventListener('change', e => { state.statsTab = e.target.value; render(); app.querySelector('#stats-kind')?.focus(); });
  app.querySelector('#stats-month')?.addEventListener('change', e => { if (!e.target.validity.valid || !/^\d{4}-\d{2}$/.test(e.target.value) || e.target.value > localDate().slice(0,7)) { e.target.value = state.month; return; } state.month = e.target.value; state.statsDate = ''; render(); app.querySelector('#stats-month')?.focus(); });
  app.querySelectorAll("[data-archive]").forEach(
    (b) =>
      (b.onclick = () => {
        state.archiveTab = b.dataset.archive;
        state.dateFilter = "";
        state.cardFilter = null;
        render();
      }),
  );
  app.querySelectorAll("[data-stats]").forEach(
    (b) =>
      (b.onclick = () => {
        state.statsTab = b.dataset.stats;
        render();
      }),
  );
  app.querySelector("#stats-date")?.addEventListener("change", (e) => {
    state.statsDate = e.target.value;
    render();
    app.querySelector("#stats-date")?.focus();
  });
  for (const direction of ["prev", "next"])
    app
      .querySelector(`[data-action="month-${direction}"]`)
      ?.addEventListener("click", () => {
        const [year, month] = state.month.split("-").map(Number);
        state.month = localDate(
          new Date(year, month - 1 + (direction === "next" ? 1 : -1), 1),
        ).slice(0, 7);
        state.statsDate = "";
        render();
      });
  app
    .querySelector('[data-action="date-records"]')
    ?.addEventListener("click", () => {
      state.dateFilter = state.statsDate;
      state.page = 0;
      state.archiveTab = "records";
      state.returnToStats = true;
      render();
    });
  app
    .querySelector('[data-action="clear-date"]')
    ?.addEventListener("click", () => {
      state.dateFilter = "";
      state.page = 0;
      render();
    });
  app
    .querySelector('[data-action="back-stats"]')
    ?.addEventListener("click", () => {
      state.archiveTab = "stats";
      state.dateFilter = "";
      state.returnToStats = false;
      render();
    });
  const chart = app.querySelector(".stats-chart");
  if (chart)
    chart.onclick = (e) => {
      const bounds = chart.getBoundingClientRect();
      const fraction = Math.max(
        0,
        Math.min(
          1,
          (((e.clientX - bounds.left) / bounds.width) * 720 - 42) / 640,
        ),
      );
      const count = new Date(
        Number(state.month.slice(0, 4)),
        Number(state.month.slice(5)),
        0,
      ).getDate();
      const date =
        state.month +
        "-" +
        String(Math.round(fraction * (count - 1)) + 1).padStart(2, "0");
      const select = app.querySelector("#stats-date");
      if (select && [...select.options].some((o) => o.value === date)) {
        state.statsDate = date;
        render();
      }
    };
}

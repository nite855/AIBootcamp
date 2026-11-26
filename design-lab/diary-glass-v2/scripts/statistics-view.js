function archivePanel() {
  const tabs = `<nav class="archive-tabs" aria-label="보관함 메뉴">${[
    ["records", "지난 기록"],
    ["stats", "돌아보기"],
    ["catalog", "캐릭터 도감"],
  ]
    .map(
      ([id, name]) =>
        `<button data-archive="${id}" aria-pressed="${state.archiveTab === id}">${name}</button>`,
    )
    .join("")}</nav>`;
  let body;
  if (state.archiveTab === "stats") body = statisticsPanel();
  else if (state.archiveTab === "catalog") body = catalogPanel();
  else {
    const records = repository.query({ date: state.dateFilter });
    const count = innerHeight < 650 ? 2 : 4;
    const pages = Math.max(1, Math.ceil(records.length / count));
    state.page = Math.min(state.page, pages - 1);
    body = `<p class="muted">${state.mode === "example" ? "예시 모드 · 내 기록과 분리" : "내 기록 · 새로고침하면 사라져요."}</p>${state.dateFilter ? `<div class="row"><span>${state.dateFilter}</span>${btn("clear-date", "날짜 필터 해제")}</div>` : ""}<div class="entry-list">${
      records
        .slice(state.page * count, (state.page + 1) * count)
        .map(
          (x) =>
            `<button class="entry" data-open="${x.id}"><span>${E(x.text)}</span><small>${x.recordDate} ${timeLabel(x.createdAt)}<br>${cardLabel(x)}</small></button>`,
        )
        .join("") || "<p>이 날짜에는 기록이 없어요.</p>"
    }</div><div class="pagination">${btn("prev", "이전", "quiet", state.page === 0 ? "disabled" : "")}<span>${state.page + 1} / ${pages}</span>${btn("next", "다음", "quiet", state.page === pages - 1 ? "disabled" : "")}${state.dateFilter ? btn("back-stats", "통계로") : ""}</div>`;
  }
  return `<section class="panel archive-panel"><div class="row"><h2>나의 페이지</h2>${btn("write", "닫기")}</div>${tabs}${body}</section>`;
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
  const controls = `<div class="month-controls">${btn("month-prev", "‹", "quiet", 'aria-label="이전 달"')}<strong>${state.month.replace("-", "년 ")}월</strong>${btn("month-next", "›", "quiet", `aria-label="다음 달" ${state.month >= localDate().slice(0, 7) ? "disabled" : ""}`)}</div><nav class="stats-tabs" aria-label="통계 종류">${[
    ["trend", "감정 추이"],
    ["count", "월간 기록"],
    ["distribution", "감정 분포"],
  ]
    .map(
      ([id, label]) =>
        `<button data-stats="${id}" aria-pressed="${state.statsTab === id}">${label}</button>`,
    )
    .join("")}</nav>`;
  let graph = "";
  if (!stats.total)
    graph = '<div class="stats-empty">아직 이 달의 기록이 없어요.</div>';
  else if (state.statsTab !== "count" && !stats.valid)
    graph = '<div class="stats-empty">분석된 기록이 아직 없어요.</div>';
  else if (state.statsTab === "distribution")
    graph = `<div class="distribution" aria-label="월간 감정 비중">${CardexCore.TYPES.map(
      (t) => {
        const value = stats.distribution.leaf[t.id];
        return `<div class="distribution-row"><span>${t.name}</span><div><i style="width:${value * 100}%;background:var(--${t.id})"></i></div><strong>${CardexCore.percent(value)}</strong></div>`;
      },
    ).join("")}</div>`;
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
  return `${controls}<p class="muted">${state.mode === "example" ? "예시 통계 · 실제 사용자 분석 아님" : "내 기록 통계 · 감정 분석은 준비 중"}</p><div class="stats-summary">기록 <strong>${stats.total}</strong>편 · 작성한 날 <strong>${stats.writtenDays}</strong>일<br><small>분석 ${stats.valid}편 · 미분석 ${stats.missing}편${state.statsTab === "trend" && stats.days.filter((x) => x.summary.validCount).length === 1 ? " · 비교할 날짜가 더 필요해요." : ""}</small></div><div class="graph-space">${graph}</div>${state.statsTab !== "distribution" && available.length ? `<div class="stats-detail"><label>날짜 <select id="stats-date">${available.map((d) => `<option value="${d.date}" ${d.date === state.statsDate ? "selected" : ""}>${d.date}</option>`).join("")}</select></label>${btn("date-records", "기록 보기")}<p>${E(details)}</p></div>` : '<p class="muted">감정 비중은 감정의 강도나 심리 점수가 아니에요.</p>'}`;
}
function bindStatistics() {
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

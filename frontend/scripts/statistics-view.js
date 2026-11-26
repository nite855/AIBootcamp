// Statistics entry motion (2026-11-21): the charts draw themselves once when the screen opens,
// the month changes or the mode switches; other re-renders on the same screen stay still.
// render() clears the key whenever another screen is shown, so coming back plays it again.
let statsAnimKey = null, statsAnimate = false;
function archivePanel() {
  let body;
  if (state.archiveTab === "stats") body = statisticsPanel();
  else if (state.archiveTab === "catalog") body = catalogPanel();
  else {
    const records = repository.query({ date: state.dateFilter }).filter(r => (!state.favoritesOnly || r.favorite) && (!state.emotionFilter || (DiaryCards.resolve(r).status === "ready" && DiaryCards.resolve(r).type === state.emotionFilter)) && r.text.toLocaleLowerCase().includes(state.search.toLocaleLowerCase()));
    if (state.sortOldest) records.reverse();
    const count = 6;
    const pages = Math.max(1, Math.ceil(records.length / count));
    state.page = Math.min(state.page, pages - 1);
    body = `<p class="muted">${state.mode === "example" ? "예시 모드 · 내 기록과 분리" : "내 기록 · 이 브라우저에 보관"}</p>${state.dateFilter ? `<div class="row"><span>${state.dateFilter}</span>${btn("clear-date", "날짜 필터 해제")}</div>` : ""}<div class="search-controls"><label for="record-search">기록 검색</label><input id="record-search" type="search" placeholder="기억나는 단어로 찾아보세요" value="${E(state.search)}"><details class="record-filters"><summary>필터${state.favoritesOnly || state.emotionFilter || state.dateFilter || state.cardFilter ? " · 적용 중" : ""}</summary><label class="favorite-filter"><input id="favorites-only" type="checkbox" ${state.favoritesOnly ? "checked" : ""}>즐겨찾기만</label><label class="emotion-filter">카드 감정 <select id="emotion-filter"><option value="">전체</option>${CardexCore.IDS.map(id => `<option value="${id}" ${state.emotionFilter === id ? "selected" : ""}>${E(CardexCore.type(id).name)}</option>`).join("")}</select></label></details><button type="button" class="quiet sort-toggle" data-sort aria-pressed="${state.sortOldest}">${state.sortOldest ? "오래된 순" : "최신 순"}</button>${state.search || state.favoritesOnly || state.emotionFilter || state.dateFilter || state.cardFilter ? btn("reset-search","필터 초기화") : ""}</div><p class="muted" role="status">${records.length}편의 기록</p><div class="entry-list">${
      records
        .slice(state.page * count, (state.page + 1) * count)
        .map(recordRow)
        .join("") || `<p>${state.dateFilter ? "이 날짜에는 기록이 없어요." : state.cardFilter ? "이 캐릭터와 연결된 기록이 없어요." : (state.search || state.favoritesOnly ? "조건에 맞는 기록이 없어요. 필터를 바꿔 보세요." : "아직 기록이 없어요. 오늘의 첫 문장을 남겨 보세요.")}</p>`
    }</div><div class="pagination" ${pages === 1 && !state.dateFilter && !state.cardFilter ? "hidden" : ""}>${pages > 1 ? btn("prev", "이전", "quiet", state.page === 0 ? "disabled" : "") + `<span>${state.page + 1} / ${pages}</span>` + btn("next", "다음", "quiet", state.page === pages - 1 ? "disabled" : "") : ""}${state.dateFilter ? btn("back-stats", "통계로") : ""}</div>`;
  }
  // Statistics and catalog are compositions of their own panels (Figma v0.3); the archive list stays one panel.
  if (state.archiveTab !== "records") return `<section class="archive-panel ${state.archiveTab}-page"${state.archiveTab === "stats" && statsAnimate ? ' data-stats-anim="in"' : ""}><h2 class="sr-only">${state.archiveTab === "stats" ? "감정 통계" : "캐릭터 도감"}</h2>${body}</section>`;
  return `<section class="panel archive-panel records-page"><div class="row"><h2>지난 기록</h2>${btn("write", "← 기록으로")}</div>${body}</section>`;
}
// One-line monthly takeaway (How We Feel-style review), shown only with enough analyzed records.
function insightLine(stats) {
  if (!stats.total) return "";
  const s = DiaryStatistics.insight(stats);
  if (!s.ready) return `<p class="month-insight muted" data-ready="false">분석된 기록이 ${DiaryStatistics.INSIGHT_MINIMUM}편 이상이면 이번 달 요약을 보여 드려요. (지금 ${s.valid}편)</p>`;
  const names = s.leafTies.map(id => CardexCore.type(id).name).join("·");
  const parents = CardexCore.PARENTS.map(p => `${p.name} ${CardexCore.percent(s.parents[p.id])}`).join(" · ");
  // Three or more tied types read as an even spread rather than a long list of names.
  const lead = s.leafTies.length >= 3 ? `분석된 ${s.valid}편에서 <strong>여러 감정이 고르게</strong> 나타났어요.`
    : `분석된 ${s.valid}편에서 가장 큰 비중은 <strong>${E(names)}</strong>${s.leafTies.length > 1 ? "(같은 비중)" : ""}이에요.`;
  return `<p class="month-insight" data-ready="true">${lead} <span class="muted">${parents} · 감정의 강도가 아닌 분류 확률이에요.</span></p>`;
}
// Most frequent analyzed card of the month (latest record versions only), or null.
function monthTopCard(month) {
  const counts = {}, stages = {};
  for (const r of repository.query({ month })) {
    const c = DiaryCards.resolve(r);
    if (c.status !== "ready") continue;
    counts[c.type] = (counts[c.type] || 0) + 1;
    (stages[c.type] ||= []).push(c.stage);
  }
  const best = CardexCore.IDS.filter(id => counts[id]).sort((a, b) => counts[b] - counts[a])[0];
  if (!best) return null;
  const lo = Math.min(...stages[best]), hi = Math.max(...stages[best]);
  return { type: best, count: counts[best], stages: lo === hi ? `${lo}단계` : `${lo}~${hi}단계` };
}
// ── Soft UI v1.1 monthly statistics (Figma "통계", "통계 · 기록 없음", "M · 통계", 2026-11-20 P6) ──
// One scrolling column of sections on every width: summary cards, positive-share trend (3-day moving
// average) with per-day card dots, distribution, emotion calendar and weekday mood. Day dots and
// calendar cells open the card modal (home-view.js openCardModal). Only current-version analyses count.
const narrowStats = () => typeof matchMedia === "function" && matchMedia("(max-width: 959px)").matches;
const monthShort = month => `${Number(month.slice(5, 7))}월`;
// Days drawn on the x-axis: the current month stops at today instead of leaving an empty tail.
function trendDays(stats) {
  const today = localDate();
  if (state.month !== today.slice(0, 7)) return stats.days;
  const end = stats.days.findIndex(d => d.date === today);
  return end < 0 ? stats.days : stats.days.slice(0, end + 1);
}
// Card palette of a day's latest record (ready cards only), for dots and calendar cells.
function dayCardStyle(date) {
  const record = dayRecord(date), card = record ? DiaryCards.resolve(record) : null;
  if (!card || card.status !== "ready") return { record, card, style: "" };
  const key = card.type.replace("_", "-");
  return { record, card, style: `--day-base:var(--card-base-${key});--day-mix:var(--card-mix-${key});--day-deep:var(--card-deep-${key})` };
}
function trendChart(stats) {
  const days = trendDays(stats), narrow = narrowStats();
  const W = narrow ? 360 : 756, H = narrow ? 200 : 250, left = 8, right = W - (narrow ? 40 : 44), top = 14, base = H - 32;
  const span = Math.max(1, days.length - 1);
  const x = i => left + (right - left) * (days.length === 1 ? 0.5 : i / span), y = v => base - v * (base - top);
  const raw = days.map(d => d.summary.validCount ? d.summary.parents.positive : null);
  const smooth = DiaryStatistics.movingAverage(raw, 3);
  const values = raw.filter(Number.isFinite), mean = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  let marks = "";
  // Figma: solid grid lines with the 100/50/0% labels on the right edge.
  for (const value of [0, 0.5, 1])
    marks += `<path class="${value ? "chart-guide" : "chart-base"}" d="M${left} ${y(value)}H${right}"/><text class="chart-axis" x="${right + 8}" y="${y(value) + 4}" text-anchor="start">${value * 100}%</text>`;
  const points = smooth.map((v, i) => v === null ? null : [x(i), y(v)]);
  // Line color (2026-11-26): the strongest emotion of the same 3-day window, as card colors that
  // blend between neighbouring days (one horizontal gradient in chart space, shared by every run).
  const tones = DiaryStatistics.windowEmotion(days, 3);
  const deep = t => `var(--card-deep-${t.type.replace("_", "-")})`;
  const stops = tones.map((t, i) => t && points[i] ? `<stop offset="${(((x(i) - left) / Math.max(1, right - left)) * 100).toFixed(2)}%" data-type="${t.type}" style="stop-color:${deep(t)}"/>` : "").join("");
  let runIndex = 0;
  for (const run of DiaryStatistics.smoothSegments(points)) {
    // Each run draws in its turn, left to right (--x = start position 0–1 across the chart).
    const at = ((run.start[0] - left) / Math.max(1, right - left)).toFixed(3);
    // Area in the line's emotion colors: a faint even wash plus a blurred copy of the line clipped
    // to the area, so the color starts right under the line at any height and fades downward
    // (a chart-wide vertical fade left low stretches nearly invisible).
    if (run.points.length > 1) {
      const area = `${run.d}L${run.end[0]} ${base}L${run.start[0]} ${base}Z`, clip = `trend-clip-${runIndex++}`;
      marks += `<clipPath id="${clip}"><path d="${area}"/></clipPath><path class="chart-area" style="--x:${at}" d="${area}"/><path class="chart-glow" clip-path="url(#${clip})" filter="url(#trend-blur)" style="--x:${at}" d="${run.d}"/>`;
    }
    const single = run.points.length > 1 ? null : tones[points.indexOf(run.start)];
    marks += run.points.length > 1 ? `<path class="chart-line" data-series="positive" pathLength="1" style="--x:${at}" d="${run.d}"/>` : `<circle class="chart-dot"${single ? ` data-type="${single.type}"` : ""} style="--x:${at}${single ? `;--trend-color:${deep(single)}` : ""}" cx="${run.start[0]}" cy="${run.start[1]}" r="4"/>`;
  }
  if (mean !== null) marks += `<path class="chart-mean" pathLength="1" d="M${left} ${y(mean)}H${right}"/><text class="chart-mean-label" x="${left + 2}" y="${y(mean) - 8}" text-anchor="start">평균 ${CardexCore.percent(mean)}</text>`;
  // Today's tooltip, when today is drawn and analyzed.
  const ti = days.findIndex(d => d.date === localDate());
  if (ti >= 0 && smooth[ti] !== null) {
    const tx = x(ti), ty = y(smooth[ti]), label = `오늘 긍정 ${CardexCore.percent(raw[ti])}`, bw = 104;
    const bx = Math.min(right - bw, Math.max(left, tx - bw + 12)), by = Math.max(0, ty - 38);
    marks += `<g class="chart-today"${tones[ti] ? ` style="--trend-color:${deep(tones[ti])}"` : ""}><circle cx="${tx}" cy="${ty}" r="7"/><rect x="${bx}" y="${by}" width="${bw}" height="26" rx="13"/><text x="${bx + bw / 2}" y="${by + 17}" text-anchor="middle">${label}</text></g>`;
  }
  const last = days.length - 1, step = narrow && days.length > 20 ? 10 : 5;
  days.forEach((d, i) => {
    if (i === 0 || i === last || ((i + 1) % step === 0 && last - i >= 2))
      marks += `<text x="${x(i)}" y="${H - 8}" text-anchor="middle" class="chart-day">${i + 1}일</text>`;
  });
  return `<svg class="stats-chart" viewBox="0 0 ${W} ${H}" data-days="${days.length}" role="img" aria-label="긍정 비율 3일 이동 평균${mean !== null ? ", 이번 달 평균 " + CardexCore.percent(mean) : ""}, 선 색은 최근 3일 동안 가장 강한 감정, 분석 없는 날은 공백"><defs><linearGradient id="trend-emotion" gradientUnits="userSpaceOnUse" x1="${left}" y1="0" x2="${right}" y2="0">${stops}</linearGradient><filter id="trend-blur" filterUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><feGaussianBlur stdDeviation="${narrow ? 7 : 10}"/></filter></defs>${marks}</svg>`;
}
// Card-colored dots under the chart, one per drawn day; recorded days open the card modal.
function trendDots(stats) {
  const today = localDate();
  return `<ol class="trend-dots" style="--days:${trendDays(stats).length}" aria-label="날짜별 카드">${trendDays(stats).map((d, i) => {
    const { record, card, style } = dayCardStyle(d.date), isToday = d.date === today;
    const cls = `trend-dot${record ? " has-record" : ""}${card?.status === "ready" ? " is-ready" : ""}${isToday ? " is-today" : ""}`;
    return `<li style="--i:${i}">${record ? `<button type="button" class="${cls}" data-card-day="${d.date}" style="${style}" aria-label="${E(longDate(d.date))}${isToday ? ", 오늘" : ""}, ${E(cardLabel(record))}"></button>` : `<span class="${cls}" aria-hidden="true"></span>`}</li>`;
  }).join("")}</ol>`;
}
// 9 rows: how many cards of each emotion this month (deep card color), most first.
function distributionRows(month) {
  const counts = Object.fromEntries(CardexCore.IDS.map(id => [id, 0]));
  for (const r of repository.query({ month })) { const c = DiaryCards.resolve(r); if (c.status === "ready") counts[c.type]++; }
  const max = Math.max(1, ...Object.values(counts));
  const order = CardexCore.IDS.slice().sort((a, b) => counts[b] - counts[a] || CardexCore.IDS.indexOf(a) - CardexCore.IDS.indexOf(b));
  return `<ol class="dist-rows">${order.map((id, i) => `<li class="dist-row" data-type="${id}" style="--i:${i}"><span class="dist-name"><i style="background:var(--card-deep-${id.replace("_", "-")})" aria-hidden="true"></i>${E(CardexCore.type(id).name)}</span><span class="dist-bar" aria-hidden="true"><b style="width:${(counts[id] / max) * 100}%;background:var(--card-deep-${id.replace("_", "-")})"></b></span><strong>${counts[id]}</strong></li>`).join("")}</ol>`;
}
// Month grid: a recorded day takes its card's gradient and shows its stage as dots.
function emotionCalendar(month) {
  const today = localDate(), first = new Date(month + "-01T12:00:00").getDay();
  const total = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
  const cells = Array.from({ length: total }, (_, i) => {
    const date = `${month}-${String(i + 1).padStart(2, "0")}`, { record, card, style } = dayCardStyle(date);
    const isToday = date === today, future = date > today, ready = card?.status === "ready";
    const cls = `emo-day${record ? " has-record" : ""}${ready ? " is-ready" : ""}${isToday ? " is-today" : ""}${future ? " is-future" : ""}`;
    const dots = ready ? `<i class="emo-stage" aria-hidden="true">${"<b></b>".repeat(card.stage)}</i>` : "";
    const label = `${longDate(date)}${isToday ? ", 오늘" : ""}, ${record ? cardLabel(record) : future ? "아직 오지 않은 날" : "기록 없음"}`;
    const current = isToday ? ' aria-current="date"' : "";
    return record
      ? `<button type="button" class="${cls}" data-card-day="${date}" style="${style};--i:${i}" aria-label="${E(label)}"${current}><span>${i + 1}</span>${dots}</button>`
      : `<span class="${cls}" style="--i:${i}" role="img" aria-label="${E(label)}"${current}><span>${i + 1}</span></span>`;
  });
  return `<div class="emo-calendar">${WEEKDAYS.map(d => `<span class="weekday" aria-hidden="true">${d}</span>`).join("")}${'<span class="emo-pad" aria-hidden="true"></span>'.repeat(first)}${cells.join("")}</div>`;
}
// Stacked positive/neutral/negative bars per weekday with the record count, plus one insight line.
function weekdayMood(month) {
  const summary = DiaryStatistics.weekdaySummary(repository.query({ month }), month);
  const insight = DiaryStatistics.weekdayInsight(summary);
  // Figma: vertical stacked bars (positive at the bottom) with the positive share above and the
  // weekday and count below; phones turn the same markup into horizontal rows (flex-basis = share).
  const top = insight && insight.positive !== null ? insight.positive : -1;
  const rows = summary.map((d, i) => {
    const p = d.parents, seg = (key, cls) => p && p[key] > 0 ? `<b class="${cls}" style="--p:${p[key]}"></b>` : "";
    const text = p ? `긍정 ${CardexCore.percent(p.positive)} · 중립 ${CardexCore.percent(p.neutral)} · 부정 ${CardexCore.percent(p.negative)}` : d.count ? "봉인된 카드" : "기록 없음";
    return `<li class="weekday-row${d.weekday === top ? " is-top" : ""}" style="--i:${i}"><span class="weekday-pct" aria-hidden="true">${p ? Math.round(p.positive * 100) + "%" : "—"}</span><span class="weekday-bar" role="img" aria-label="${WEEKDAYS[d.weekday]}요일, ${text}, ${d.count}편">${seg("positive", "seg-pos")}${seg("neutral", "seg-neu")}${seg("negative", "seg-neg")}</span><span class="weekday-name">${WEEKDAYS[d.weekday]}</span><small>${d.count}편</small></li>`;
  }).join("");
  const parts = insight ? [insight.positive !== null ? `${WEEKDAYS[insight.positive]}요일엔 긍정이` : "", insight.negative !== null ? `${WEEKDAYS[insight.negative]}요일엔 부정이` : ""].filter(Boolean) : [];
  const line = parts.length ? `<p class="weekday-insight"><i aria-hidden="true">✦</i>${parts.join(", ")} 많았어요</p>` : `<p class="weekday-insight muted">분석된 기록이 ${DiaryStatistics.INSIGHT_MINIMUM}편 이상이면 요일별 흐름을 알려 드려요.</p>`;
  return `<ol class="weekday-rows">${rows}</ol>${line}`;
}
function statisticsPanel() {
  const stats = DiaryStatistics.monthSummary(repository.query({ month: state.month }), state.month);
  const thisMonth = localDate().slice(0, 7), next = DiaryStatistics.shiftMonth(state.month, 1), prev = DiaryStatistics.shiftMonth(state.month, -1);
  const delta = DiaryStatistics.monthDelta(activeRecords(), state.month);
  const top = monthTopCard(state.month), topRecord = top ? repository.query({ month: state.month }).find(r => { const c = DiaryCards.resolve(r); return c.status === "ready" && c.type === top.type; }) : null;
  const example = state.mode === "example";
  const animKey = `${state.mode}:${state.month}`;
  statsAnimate = animKey !== statsAnimKey;
  statsAnimKey = animKey;
  // Month pill: ‹ previous | current | next › (never past this month).
  const nav = `<div class="month-pill" role="group" aria-label="달 이동"><button type="button" data-month-step="-1" aria-label="이전 달 (${monthShort(prev)})">‹ ${monthShort(prev)}</button><strong aria-current="true">${monthShort(state.month)}</strong><button type="button" data-month-step="1" aria-label="다음 달 (${monthShort(next)})" ${state.month >= thisMonth ? "disabled" : ""}>${monthShort(next)} ›</button></div>`;
  const head = `<div class="stats-head page-heading"><div><h2 class="stats-title">${monthShort(state.month)}의 마음</h2><p class="muted"><strong class="month-title">${monthTitle(state.month)}</strong> · 기록 ${stats.total}편${example ? " · 시연용 합성 데이터" : ""}</p></div>${nav}</div>`;
  const deltaText = !stats.total && !delta.previous ? "첫 기록을 남겨 보세요" : delta.delta > 0 ? `지난달보다 ${delta.delta}편 더 남겼어요` : delta.delta < 0 ? `지난달보다 ${-delta.delta}편 적어요` : "지난달과 같아요";
  const parents = stats.valid ? stats.distribution.parents : null;
  // Ratio tile (Figma): whole-number shares with a small "%", a colored dot per parent and a
  // segmented bar with gaps.
  const pct = v => Math.round(v * 100);
  const ratio = parents
    ? `<p class="ratio-values">${CardexCore.PARENTS.map(p => `<span><b data-count="${pct(parents[p.id])}">${pct(parents[p.id])}</b><em>%</em><small><i class="seg-${p.id.slice(0, 3)}" aria-hidden="true"></i>${p.name}</small></span>`).join("")}</p><span class="ratio-bar" aria-hidden="true">${CardexCore.PARENTS.filter(p => parents[p.id] > 0).map((p, i) => `<b class="seg-${p.id.slice(0, 3)}" style="flex-grow:${parents[p.id]};--i:${i}"></b>`).join("")}</span>`
    : `<p class="ratio-values is-empty"><b>—</b></p>`;
  const summary = `<div class="stats-cards"><section class="panel stats-card stats-count${stats.total ? "" : " is-empty"}"><p class="stats-label">이번 달 기록</p><p class="stats-big"><b class="moment-number" data-count="${stats.total}">${stats.total}</b>편</p><small class="stats-delta"><span class="wide-only">${deltaText}</span><span class="narrow-only">${delta.delta && (stats.total || delta.previous) ? `지난달보다 ${delta.delta > 0 ? "+" : ""}${delta.delta}` : deltaText}</span></small></section>
    <section class="panel stats-card stats-ratio" aria-label="감정 비율"><p class="stats-label">감정 비율</p>${ratio}</section>
    <section class="panel stats-card stats-summary-card" aria-label="가장 많이 받은 카드"><p class="stats-label">가장 많이 받은 카드</p>${top ? `<div class="top-card"><div><strong>${E(CardexCore.type(top.type).name)}</strong><small>${top.count}편 · ${top.stages}</small></div>${miniCard(topRecord)}</div>` : `<p class="ratio-values is-empty"><b>—</b></p>`}</section></div>`;
  if (!stats.total)
    return `${head}${summary}<section class="panel stats-empty-panel"><span class="stage-glow" aria-hidden="true"></span><p class="stats-empty-title">기록이 쌓이면 마음의 흐름을 보여드릴게요</p><p class="muted">분석된 기록이 ${DiaryStatistics.INSIGHT_MINIMUM}편 이상이면 감정 추이 그래프가 그려져요</p>${state.month === thisMonth ? btn("write", "오늘 기록하기", "primary") : ""}</section>`;
  // The explanatory note and the insight (not in Figma) stay as one small caption line.
  const trendBody = stats.valid
    ? trendChart(stats) + trendDots(stats) + `<p class="chart-note">선과 점의 색은 카드 색이에요 · 점을 누르면 그날의 카드가 열려요</p>`
    : `<div class="stats-empty"><p>감정 읽기는 준비 중이에요. 기록은 달력에서 열어 볼 수 있어요.</p></div>` + trendDots(stats);
  // Records exist but none is analyzed (real records until the model is connected): one page-level
  // banner says why the ratio, distribution and weekday panels are empty, so writing more never looks like the fix.
  const waiting = stats.valid ? "" : `<p class="stats-wait-banner" role="note"><b>감정 읽기 전</b><span>이번 달 기록 ${stats.total}편은 잘 저장됐어요. AI 감정 읽기가 연결되면 비율·분포·요일별 마음이 채워져요.</span>${state.mode === "real" ? btn("preview", "시연 모드로 미리 보기", "quiet") : ""}</p>`;
  return `${head}${waiting}${summary}<div class="stats-sections">
    <section class="panel stats-main stats-trend" aria-labelledby="stats-trend-title"><div class="row"><h3 id="stats-trend-title">감정 추이</h3><small>긍정 비율 · 3일 이동 평균<span class="wide-only"> · 선 색 = 3일간 가장 강한 감정</span></small></div>${trendBody}${insightLine(stats)}</section>
    <section class="panel stats-dist" aria-labelledby="dist-title"><div class="row"><h3 id="dist-title"><span class="wide-only">감정 분포</span><span class="narrow-only">많이 받은 감정</span></h3><small>9종 · 받은 카드 수</small></div>${distributionRows(state.month)}</section>
    <section class="panel stats-mood"><div class="stats-calendar" aria-labelledby="stats-calendar-title"><div class="row"><div><h3 id="stats-calendar-title">${monthShort(state.month)} 감정 달력</h3><small>칸 색 = 그날 받은 카드 · 점 = 카드 단계 · 회색 = 분석 전</small></div></div>${emotionCalendar(state.month)}</div><div class="stats-weekday" aria-labelledby="weekday-title"><div class="row"><div><h3 id="weekday-title">요일별 마음</h3><small>요일마다 긍정 · 중립 · 부정 비율</small></div><p class="weekday-legend" aria-hidden="true"><span><i class="seg-pos"></i>긍정</span><span><i class="seg-neu"></i>중립</span><span><i class="seg-neg"></i>부정</span></p></div>${weekdayMood(state.month)}</div></section>
  </div>`;
}
// Summary numbers count up from 0 while the charts draw; the final text is already in the markup
// and is restored exactly at the end.
function countUpStatistics() {
  const nodes = [...app.querySelectorAll('[data-stats-anim="in"] [data-count]')];
  if (!nodes.length) return;
  const start = performance.now(), duration = 700;
  const tick = now => {
    const t = Math.min(1, (now - start) / duration), ease = 1 - Math.pow(1 - t, 3);
    let alive = false;
    for (const el of nodes) {
      if (!el.isConnected) continue;
      alive = true;
      el.textContent = t < 1 ? String(Math.round(Number(el.dataset.count) * ease)) : el.dataset.count;
    }
    if (alive && t < 1) requestAnimationFrame(tick);
  };
  nodes.forEach(el => { el.textContent = "0"; });
  requestAnimationFrame(tick);
}
function bindStatistics() {
  countUpStatistics();
  app.querySelectorAll("[data-home-month]").forEach(b => b.addEventListener("click", () => {
    const step = Number(b.dataset.homeMonth);
    state.homeMonth = DiaryStatistics.shiftMonth(state.homeMonth, step, localDate().slice(0, 7));
    syncCalendarWeek(state.homeMonth);
    render();
    const same = app.querySelector(`[data-home-month="${step}"]`);
    (same && !same.disabled ? same : app.querySelector(`[data-home-month="${-step}"]`))?.focus();
  }));
  app.querySelectorAll("[data-archive]").forEach(
    (b) =>
      (b.onclick = () => {
        state.archiveTab = b.dataset.archive;
        state.dateFilter = "";
        state.cardFilter = null;
        render();
      }),
  );
  app.querySelectorAll("[data-week-step]").forEach(b => b.addEventListener("click", () => {
    const step = Number(b.dataset.weekStep);
    state.calendarWeek = DiaryStatistics.shiftWeek(state.calendarWeek, step, localDate());
    render();
    const same = app.querySelector(`[data-week-step="${step}"]`);
    (same && !same.disabled ? same : app.querySelector(`[data-week-step="${-step}"]`))?.focus();
  }));
  app.querySelectorAll("[data-month-step]").forEach(b => b.addEventListener("click", () => {
    const step = Number(b.dataset.monthStep);
    state.month = DiaryStatistics.shiftMonth(state.month, step, localDate().slice(0, 7));
    syncCalendarWeek(state.month);
    render();
    // Keep focus on the pressed control; fall back to the other one when it becomes disabled.
    const same = app.querySelector(`[data-month-step="${step}"]`);
    (same && !same.disabled ? same : app.querySelector(`[data-month-step="${-step}"]`))?.focus();
  }));
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
  const emotion = app.querySelector("#emotion-filter");
  if (emotion) emotion.onchange = () => { state.emotionFilter = emotion.value; state.page = 0; render(); const d = app.querySelector(".record-filters"); if (d) d.open = true; app.querySelector("#emotion-filter")?.focus(); };
  const sort = app.querySelector("[data-sort]");
  if (sort) sort.onclick = () => { state.sortOldest = !state.sortOldest; state.page = 0; render(); app.querySelector("[data-sort]")?.focus(); };
}

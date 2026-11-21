(function (root, factory) {
  const api = factory(
    typeof module === "object" ? require("./core.js") : root.CardexCore,
  );
  if (typeof module === "object") module.exports = api;
  else root.DiaryStatistics = api;
})(globalThis, function (C) {
  "use strict";
  function monthSummary(records, month) {
    const days = new Date(
      Number(month.slice(0, 4)),
      Number(month.slice(5)),
      0,
    ).getDate();
    const selected = records.filter((r) => r.recordDate?.slice(0, 7) === month);
    const buckets = Array.from({ length: days }, (_, i) => ({
      date: month + "-" + String(i + 1).padStart(2, "0"),
      count: 0,
      rows: [],
    }));
    for (const r of selected) {
      const b = buckets.find((b) => b.date === r.recordDate);
      if (!b) continue;
      b.count++;
      if (
        r.analysis?.status === "valid" &&
        Number.isSafeInteger(r.version) && r.version > 0 && r.analysis.version === r.version
      ) {
        try {
          C.validateAnalysis(r.analysis);
          b.rows.push({
            status: "valid",
            probabilities: r.analysis.probabilities,
          });
        } catch {
          /* Invalid analysis is excluded, never replaced by neutral. */
        }
      }
    }
    const rows = buckets.flatMap((b) => b.rows);
    return {
      total: buckets.reduce((n, b) => n + b.count, 0),
      writtenDays: buckets.filter((b) => b.count).length,
      valid: rows.length,
      missing: selected.length - rows.length,
      distribution: C.aggregate(rows),
      days: buckets.map((b) => ({ ...b, summary: C.aggregate(b.rows) })),
    };
  }
  // Monthly takeaway from model analysis only; withheld until enough records are analyzed.
  const INSIGHT_MINIMUM = 3;
  function insight(stats, minimum = INSIGHT_MINIMUM) {
    const valid = Number.isSafeInteger(stats?.valid) ? stats.valid : 0;
    const d = stats?.distribution;
    if (valid < minimum || !d?.leaf) return { ready: false, valid, needed: Math.max(0, minimum - valid) };
    return { ready: true, valid, leaf: d.dominantLeaf, leafTies: d.leafTies, parent: d.dominantParent, parents: d.parents };
  }
  // Representative emotion of one calendar day, or null when the day has no valid analysis.
  function dayEmotion(day) {
    return day?.summary?.validCount ? day.summary.dominantLeaf : null;
  }
  // Month navigation never goes past the current month.
  function shiftMonth(month, step, current) {
    if (!/^\d{4}-\d{2}$/.test(month) || !Number.isSafeInteger(step)) return month;
    const [y, m] = month.split("-").map(Number), total = y * 12 + (m - 1) + step;
    const next = String(Math.floor(total / 12)).padStart(4, "0") + "-" + String((total % 12) + 1).padStart(2, "0");
    return current && next > current ? month : next;
  }
  // Smooth trend path (Catmull-Rom → cubic Bézier). `points` holds [x, y] or null for days
  // without analysis; nulls split the line so missing days stay visible as gaps.
  // Control points are clamped between neighbouring values, so the curve never overshoots.
  function smoothSegments(points) {
    const runs = [];
    let run = [];
    for (const p of Array.isArray(points) ? points : []) {
      const ok = Array.isArray(p) && p.length === 2 && p.every(Number.isFinite);
      if (ok) run.push(p);
      else if (run.length) { runs.push(run); run = []; }
    }
    if (run.length) runs.push(run);
    const f = (n) => Math.round(n * 100) / 100;
    const clamp = (v, a, b) => Math.min(Math.max(v, Math.min(a, b)), Math.max(a, b));
    return runs.map((r) => {
      let d = `M${f(r[0][0])} ${f(r[0][1])}`;
      for (let i = 0; i < r.length - 1; i++) {
        const p0 = r[i - 1] || r[i], p1 = r[i], p2 = r[i + 1], p3 = r[i + 2] || p2;
        const c1 = [p1[0] + (p2[0] - p0[0]) / 6, clamp(p1[1] + (p2[1] - p0[1]) / 6, p1[1], p2[1])];
        const c2 = [p2[0] - (p3[0] - p1[0]) / 6, clamp(p2[1] - (p3[1] - p1[1]) / 6, p1[1], p2[1])];
        d += `C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
      }
      return { d, points: r, start: r[0], end: r[r.length - 1] };
    });
  }
  // Calendar weeks run Sunday to Saturday (same as the month grid). Dates are local YYYY-MM-DD
  // strings, so arithmetic happens in UTC to stay clear of daylight-saving shifts.
  const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
  function parseDate(date) {
    const m = DATE.exec(date);
    if (!m) return null;
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3] ? d : null;
  }
  const formatDate = d => d.toISOString().slice(0, 10);
  function addDays(date, days) {
    const d = parseDate(date);
    if (!d || !Number.isSafeInteger(days)) return date;
    d.setUTCDate(d.getUTCDate() + days);
    return formatDate(d);
  }
  function weekStart(date) {
    const d = parseDate(date);
    return d ? addDays(date, -d.getUTCDay()) : null;
  }
  // The seven dates of the week that contains `date`, or [] for an invalid date.
  function weekDates(date) {
    const start = weekStart(date);
    return start ? Array.from({ length: 7 }, (_, i) => addDays(start, i)) : [];
  }
  // Week navigation never goes past the week of `today`.
  function shiftWeek(start, step, today) {
    const from = weekStart(start), limit = weekStart(today);
    if (!from || !limit || !Number.isSafeInteger(step)) return from || start;
    const next = addDays(from, step * 7);
    return next > limit ? limit : next;
  }
  // Consecutive written days ending today. A streak stays alive until today is over, so an
  // unwritten today counts back from yesterday. Invalid or duplicate dates are ignored.
  function streakDays(dates, today) {
    if (!parseDate(today)) return 0;
    const written = new Set((Array.isArray(dates) ? dates : []).filter((d) => typeof d === "string" && parseDate(d)));
    let day = written.has(today) ? today : addDays(today, -1), count = 0;
    while (written.has(day)) { count++; day = addDays(day, -1); }
    return count;
  }
  // Week name for the record calendar ("11월 3주"): the month of the week's Sunday and the row
  // that week takes in that month's Sunday-first grid. Null for an invalid date.
  function weekLabel(date) {
    const start = parseDate(weekStart(date) || "");
    if (!start) return null;
    const firstDay = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1)).getUTCDay();
    return { month: start.getUTCMonth() + 1, week: Math.floor((start.getUTCDate() - 1 + firstDay) / 7) + 1 };
  }
  // Trailing moving average for the trend line. `series` holds numbers or null (no analysis);
  // a null stays null, otherwise the value is the mean of the non-null values in the window.
  function movingAverage(series, size = 3) {
    const list = Array.isArray(series) ? series : [];
    const n = Number.isSafeInteger(size) && size > 0 ? size : 1;
    return list.map((v, i) => {
      if (!Number.isFinite(v)) return null;
      const win = list.slice(Math.max(0, i - n + 1), i + 1).filter(Number.isFinite);
      return win.reduce((a, b) => a + b, 0) / win.length;
    });
  }
  // Records this month against the previous month (January compares with last December).
  function monthDelta(records, month) {
    const list = Array.isArray(records) ? records : [];
    if (!/^\d{4}-\d{2}$/.test(month || "")) return { current: 0, previous: 0, delta: 0 };
    const prev = shiftMonth(month, -1);
    const count = (m) => list.filter((r) => r?.recordDate?.slice(0, 7) === m).length;
    const current = count(month), previous = count(prev);
    return { current, previous, delta: current - previous };
  }
  // Weekday (Sunday = 0) totals for a month: records, analyzed records and averaged parent shares.
  // Only analyses of the current record version count, as in monthSummary.
  function weekdaySummary(records, month) {
    const days = monthSummary(Array.isArray(records) ? records : [], month).days;
    const buckets = Array.from({ length: 7 }, (_, weekday) => ({ weekday, count: 0, rows: [] }));
    for (const d of days) {
      const b = buckets[parseDate(d.date).getUTCDay()];
      b.count += d.count;
      b.rows.push(...d.rows);
    }
    return buckets.map(({ weekday, count, rows }) => {
      const s = C.aggregate(rows);
      return { weekday, count, valid: s.validCount, parents: s.parents };
    });
  }
  // "금요일엔 긍정이, 목요일엔 부정이 많았어요": the weekday with the highest positive share and the one
  // with the highest negative share. Withheld below `minimum` analyzed records; a tied lead drops its half.
  function weekdayInsight(summary, minimum = INSIGHT_MINIMUM) {
    const rows = (Array.isArray(summary) ? summary : []).filter((d) => d?.valid > 0);
    if (rows.reduce((n, d) => n + d.valid, 0) < minimum) return null;
    const lead = (key) => {
      const top = Math.max(...rows.map((d) => d.parents[key]));
      const best = rows.filter((d) => Math.abs(d.parents[key] - top) < 1e-9);
      return top > 0 && best.length === 1 ? best[0].weekday : null;
    };
    const positive = lead("positive"), negative = lead("negative");
    return positive === null && negative === null ? null : { positive, negative };
  }
  return { monthSummary, insight, dayEmotion, shiftMonth, smoothSegments, weekStart, weekDates, shiftWeek, addDays, streakDays, weekLabel, movingAverage, monthDelta, weekdaySummary, weekdayInsight, INSIGHT_MINIMUM };
});

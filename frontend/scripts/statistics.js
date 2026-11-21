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
  return { monthSummary, insight, dayEmotion, shiftMonth, smoothSegments, INSIGHT_MINIMUM };
});

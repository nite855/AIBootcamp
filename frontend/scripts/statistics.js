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
  return { monthSummary };
});

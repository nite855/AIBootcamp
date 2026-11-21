(function (root, factory) {
  const api = factory(
    typeof module === "object" ? require("./core.js") : root.CardexCore,
  );
  if (typeof module === "object") module.exports = api;
  else root.DiaryCards = api;
})(globalThis, function (C) {
  function resolve(record) {
    if (!record) return { status: "pending", stage: 0 };
    const a = record.analysis;
    if (!a || a.status !== "valid")
      return { status: a?.status === "error" ? "error" : "pending", stage: 0 };
    if (a.version !== record.version) return { status: "pending", stage: 0 };
    try {
      C.validateAnalysis(a);
    } catch {
      return { status: "error", stage: 0 };
    }
    const score = Math.max(...C.IDS.map((id) => a.probabilities[id]));
    const ties = C.IDS.filter((id) => a.probabilities[id] === score);
    return {
      recordId: record.id,
      status: score < 0.3 ? "blank" : "ready",
      type: ties[0],
      ties,
      score,
      stage: score < 0.3 ? 0 : score < 0.6 ? 1 : score < 0.9 ? 2 : 3,
    };
  }
  function collection(records) {
    return C.IDS.flatMap((type) =>
      [1, 2, 3].map((stage) => ({
        type,
        stage,
        records: records
          .filter((r) => {
            const c = resolve(r);
            return c.status === "ready" && c.type === type && c.stage === stage;
          })
          .map((r) => r.id),
      })),
    );
  }
  // Catalog slots ("type:stage") that currently have at least one analyzed card.
  function unlockedKeys(records) {
    return collection(Array.isArray(records) ? records : [])
      .filter((s) => s.records.length)
      .map((s) => s.type + ":" + s.stage);
  }
  // Slots open now but not before, in catalog order; drives the one-time "new card" celebration.
  function newlyUnlocked(before, after) {
    const seen = new Set(before || []);
    return (after || []).filter((k) => !seen.has(k));
  }
  return { resolve, collection, unlockedKeys, newlyUnlocked };
});

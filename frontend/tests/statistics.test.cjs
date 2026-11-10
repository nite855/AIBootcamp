const { test } = require("node:test");
const assert = require("node:assert/strict");
const S = require("../scripts/statistics.js"),
  C = require("../scripts/core.js");
const probabilities = Object.fromEntries(
  C.IDS.map((id, i) => [id, i === 0 ? 1 : 0]),
);
const row = (date, analysis = { status: "valid", probabilities }) => ({
  recordDate: date,
  version: 1,
  analysis: analysis && { version:1, taxonomy_version:C.TAXONOMY, ...analysis },
});
test("counts records separately from days, supports leap months and missing analysis", () => {
  const s = S.monthSummary(
    [
      row("2024-02-01"),
      row("2024-02-01"),
      row("2024-02-29", { status: "pending" }),
      row("2024-03-01"),
    ],
    "2024-02",
  );
  assert.equal(s.total, 3);
  assert.equal(s.writtenDays, 2);
  assert.equal(s.valid, 2);
  assert.equal(s.missing, 1);
  assert.equal(s.days.length, 29);
  assert.equal(s.days[1].summary.leaf, null);
  assert.equal(s.days[1].count, 0);
});
test("monthly distribution weights source records, not daily averages", () => {
  const neutral = Object.fromEntries(
    C.IDS.map((id) => [id, id === "neu_1" ? 1 : 0]),
  );
  const s = S.monthSummary(
    [
      row("2026-11-01"),
      row("2026-11-01"),
      row("2026-11-02", { status: "valid", probabilities: neutral }),
    ],
    "2026-11",
  );
  assert.equal(s.distribution.leaf.pos_1, 2 / 3);
  assert.equal(s.days[1].summary.parents.neutral, 1);
});
test("invalid, absent and empty analysis are distinct from neutral", () => {
  const s = S.monthSummary(
    [
      row("2026-11-01", { status: "valid", probabilities: { neutral: 1 } }),
      row("2026-11-02", null),
    ],
    "2026-11",
  );
  assert.equal(s.total, 2);
  assert.equal(s.valid, 0);
  assert.equal(s.missing, 2);
  assert.equal(s.distribution.leaf, null);
  assert.equal(S.monthSummary([], "2026-11").total, 0);
});

test("old taxonomies, stale records and truncated results are excluded without changing record counts", () => {
  const old = row('2026-11-01',{status:'valid',probabilities,taxonomy_version:'old'});
  const stale = {...row('2026-11-01'), version:2};
  const truncated = row('2026-11-01',{status:'valid',probabilities,truncated:true});
  const s=S.monthSummary([row('2026-11-01'),old,stale,truncated],'2026-11');
  assert.equal(s.total,4);assert.equal(s.valid,1);assert.equal(s.missing,3);
  assert.equal(s.distribution.leaf.pos_1,1);
});

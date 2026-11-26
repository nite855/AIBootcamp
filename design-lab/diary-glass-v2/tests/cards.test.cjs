const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  C = require("../scripts/core.js"),
  D = require("../scripts/cards.js");
const row = (score, type = "pos_1") => ({
  id: "a",
  version: 1,
  analysis: {
    version: 1,
    status: "valid",
    probabilities: Object.fromEntries(
      C.IDS.map((id) => [id, id === type ? score : (1 - score) / 6]),
    ),
  },
});
test("exact unrounded thresholds", () => {
  for (const [score, stage] of [
    [0.299999, 0],
    [0.3, 1],
    [0.599999, 1],
    [0.6, 2],
    [0.899999, 2],
    [0.9, 3],
    [1, 3],
  ])
    assert.equal(D.resolve(row(score)).stage, stage);
});
test("stale, failed and missing analysis never unlock", () => {
  const r = row(0.9);
  r.version = 2;
  assert.equal(D.resolve(r).status, "pending");
  assert.equal(D.resolve({}).status, "pending");
  assert.equal(
    D.resolve({ version: 1, analysis: { status: "error" } }).status,
    "error",
  );
});
test("collection matches exact stage and recalculates removal", () => {
  assert.equal(
    D.collection([row(0.9)]).filter((x) => x.records.length).length,
    1,
  );
  assert.equal(D.collection([]).filter((x) => x.records.length).length, 0);
  const r = row(0.9);
  r.analysis = { status: "pending" };
  assert.equal(D.collection([r]).filter((x) => x.records.length).length, 0);
});
test("tie uses taxonomy order and preserves ties", () => {
  const r = row(0.3);
  r.analysis.probabilities = {
    pos_1: 0.3,
    pos_2: 0.3,
    pos_3: 0.08,
    neg_1: 0.08,
    neg_2: 0.08,
    neg_3: 0.08,
    neutral: 0.08,
  };
  assert.equal(D.resolve(r).type, "pos_1");
  assert.equal(D.resolve(r).ties.length, 2);
});

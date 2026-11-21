const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  C = require("../scripts/core.js"),
  D = require("../scripts/cards.js"),
  S = require("../scripts/statistics.js");
const row = (id, score, type = "pos_1", version = 1, analysisVersion = version) => ({
  id,
  version,
  analysis: {
    version: analysisVersion,
    taxonomy_version: C.TAXONOMY,
    status: "valid",
    probabilities: Object.fromEntries(
      C.IDS.map((t) => [t, t === type ? score : (1 - score) / (C.IDS.length - 1)]),
    ),
  },
});

test("smoothSegments: empty, invalid and single-point input", () => {
  assert.deepEqual(S.smoothSegments([]), []);
  assert.deepEqual(S.smoothSegments(undefined), []);
  assert.deepEqual(S.smoothSegments([null, [NaN, 1], [1], "x"]), []);
  const [one] = S.smoothSegments([[10, 20]]);
  assert.equal(one.d, "M10 20");
  assert.deepEqual(one.start, one.end);
});

test("smoothSegments: missing days split the line into separate runs", () => {
  const runs = S.smoothSegments([[0, 10], [10, 20], null, [30, 5], [40, 15], [50, 10]]);
  assert.equal(runs.length, 2);
  assert.equal(runs[0].points.length, 2);
  assert.equal(runs[1].points.length, 3);
  assert.match(runs[0].d, /^M0 10C/);
  assert.equal((runs[1].d.match(/C/g) || []).length, 2);
  assert.deepEqual(runs[1].end, [50, 10]);
});

test("smoothSegments: control points never overshoot neighbouring values", () => {
  const [run] = S.smoothSegments([[0, 100], [10, 0], [20, 100], [30, 0]]);
  const numbers = run.d.match(/-?\d+(\.\d+)?/g).map(Number);
  const ys = numbers.filter((_, i) => i % 2 === 1);
  assert.ok(ys.every((y) => y >= 0 && y <= 100), run.d);
});

test("unlockedKeys counts only ready cards of the current version", () => {
  const records = [
    row("a", 0.95, "pos_1"),
    row("b", 0.95, "pos_1"),            // same slot twice → one key
    row("c", 0.45, "neg_2"),
    row("d", 0.2, "neg_3"),             // blank card, no slot
    row("e", 0.95, "neu_1", 2, 1),      // stale analysis of an older version
  ];
  assert.deepEqual(D.unlockedKeys(records), ["pos_1:3", "neg_2:1"]);
  assert.deepEqual(D.unlockedKeys(null), []);
});

test("newlyUnlocked reports only slots that were not open before", () => {
  assert.deepEqual(D.newlyUnlocked(["pos_1:3"], ["pos_1:3", "neg_2:1"]), ["neg_2:1"]);
  assert.deepEqual(D.newlyUnlocked(["pos_1:3"], ["pos_1:3"]), []);
  assert.deepEqual(D.newlyUnlocked(undefined, ["pos_1:3"]), ["pos_1:3"]);
  assert.deepEqual(D.newlyUnlocked(["pos_1:3"], undefined), []);
});

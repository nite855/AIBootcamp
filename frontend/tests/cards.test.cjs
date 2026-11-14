const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  C = require("../scripts/core.js"),
  D = require("../scripts/cards.js");
const row = (score, type = "pos_1") => ({
  id: "a",
  version: 1,
  analysis: {
    version: 1,
    taxonomy_version: C.TAXONOMY,
    status: "valid",
    probabilities: Object.fromEntries(
      C.IDS.map((id) => [id, id === type ? score : (1 - score) / (C.IDS.length - 1)]),
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
  r.analysis.probabilities = Object.fromEntries(C.IDS.map((id, i) => [id, i < 2 ? 0.3 : 0.4 / 8]));
  assert.equal(D.resolve(r).type, "pos_1");
  assert.equal(D.resolve(r).ties.length, 2);
});

test("all thirty slots unlock independently and relock after removing the last record", () => {
  const records = C.IDS.flatMap(type => [.45,.75,.95].map((score, i) => ({...row(score,type), id:type+'-'+i})));
  const slots = D.collection(records);
  assert.equal(slots.length,30);
  assert.equal(new Set(slots.map(s => s.type+':'+s.stage)).size,30);
  assert.ok(slots.every(s => s.records.length === 1));
  assert.equal(D.collection(records.slice(1)).filter(s => s.records.length).length,29);
  records[0].version++;
  assert.equal(D.collection(records).filter(s => s.records.length).length,29);
});
test("wrong taxonomy, missing taxonomy, truncated and malformed analysis never unlock", () => {
  for (const change of [{taxonomy_version:'emotion-cardex-ui-demo-3plus7-v1'}, {taxonomy_version:undefined}, {truncated:true}, {probabilities:{neutral:1}}]) {
    const r=row(.95);Object.assign(r.analysis,change);
    assert.equal(D.resolve(r).status,'error');
    assert.ok(D.collection([r]).every(slot => !slot.records.length));
  }
});

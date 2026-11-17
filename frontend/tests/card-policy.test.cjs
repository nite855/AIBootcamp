const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const Core = require("../src/domain/core9.js");
const REPO_ROOT = path.resolve(__dirname, "../..");
const FRONTEND_ROOT = path.resolve(__dirname, "..");

async function loadPolicy() {
  return import(pathToFileURL(path.join(FRONTEND_ROOT, "src/domain/cardPolicy.mjs")).href);
}

const readFixture = (name) =>
  JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "contracts/fixtures", name), "utf8"));

test("cardPolicy matches contracts/fixtures/card-boundaries.json strict-gt and ties", async () => {
  const {
    CARD_POLICY_VERSION,
    STAGE_2_THRESHOLD,
    STAGE_3_THRESHOLD,
    createDiaryCards,
    evaluateCardProbabilities,
  } = await loadPolicy();

  assert.equal(CARD_POLICY_VERSION, "card-stage-strict-gt-v1");
  assert.equal(STAGE_2_THRESHOLD, 1 / 3);
  assert.equal(STAGE_3_THRESHOLD, 2 / 3);

  const fixture = readFixture("card-boundaries.json");
  const cards = createDiaryCards(Core);

  for (const c of fixture.cases) {
    const actual = evaluateCardProbabilities(c.probabilities, Core.IDS);
    for (const [k, expected] of Object.entries(c.expected)) {
      assert.deepEqual(actual[k], expected, `${c.id}.${k}`);
    }

    const resolved = cards.resolve({
      id: c.id,
      version: 1,
      analysis: {
        status: "valid",
        version: 1,
        taxonomy_version: Core.TAXONOMY,
        truncated: false,
        probabilities: c.probabilities,
      },
    });
    assert.equal(resolved.status, "ready", `${c.id} must resolve ready (no blank stage)`);
    assert.equal(resolved.type, c.expected.dominant_emotion);
    assert.deepEqual(resolved.ties, c.expected.ties);
    assert.equal(resolved.stage, c.expected.card_stage);
    assert.equal(resolved.cardKey, c.expected.card_key);
    assert.equal(resolved.cardPolicyVersion, CARD_POLICY_VERSION);
  }
});

test("cardPolicy rejects all invalid-distributions.json cases without issuing cards", async () => {
  const { createDiaryCards, evaluateCardProbabilities } = await loadPolicy();
  const fixture = readFixture("invalid-distributions.json");
  const cards = createDiaryCards(Core);

  for (const c of fixture.probability_cases) {
    assert.throws(
      () => evaluateCardProbabilities(c.probabilities, Core.IDS),
      (err) => err && err.code === c.expected_error,
      c.id,
    );
    const resolved = cards.resolve({
      id: c.id,
      version: 1,
      analysis: {
        status: "valid",
        version: 1,
        taxonomy_version: Core.TAXONOMY,
        truncated: false,
        probabilities: c.probabilities,
      },
    });
    assert.equal(resolved.status, "error", `${c.id} must resolve error`);
    assert.equal(resolved.stage, 0);
  }

  for (const c of fixture.analysis_cases) {
    const resolved = cards.resolve({ id: c.id, version: 1, analysis: c.analysis });
    assert.notEqual(resolved.status, "ready", `${c.id} must not issue a card`);
    assert.equal(resolved.stage, 0);
  }
});

test("27 catalog slots unlock cleanly under 0 / 1/3 / 2/3 policy and relock on removal", async () => {
  const { createDiaryCards } = await loadPolicy();
  const cards = createDiaryCards(Core);

  const records = Core.IDS.flatMap((type) =>
    [0.25, 0.5, 0.85].map((score, idx) => ({
      id: `${type}-${idx + 1}`,
      version: 1,
      analysis: {
        status: "valid",
        version: 1,
        taxonomy_version: Core.TAXONOMY,
        truncated: false,
        probabilities: Object.fromEntries(
          Core.IDS.map((id) => [id, id === type ? score : (1 - score) / (Core.IDS.length - 1)]),
        ),
      },
    })),
  );

  const slots = cards.collection(records);
  assert.equal(slots.length, 27);
  assert.ok(slots.every((s) => s.records.length === 1));
  assert.equal(cards.unlockedKeys(records).length, 27);

  // Version bump invalidates analysis and relocks that slot.
  records[0].version = 2;
  assert.equal(cards.unlockedKeys(records).length, 26);
});

test("CatalogView does not hardcode legacy 30/60/90% stage thresholds", () => {
  const catalogVue = fs.readFileSync(
    path.join(FRONTEND_ROOT, "src/views/CatalogView.vue"),
    "utf8",
  );
  assert.ok(catalogVue.includes("STAGE_LABELS"));
  assert.ok(!catalogVue.includes("30~60%"));
  assert.ok(!catalogVue.includes("60~90%"));
  assert.ok(!catalogVue.includes("90% 이상"));
});

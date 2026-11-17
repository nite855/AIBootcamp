const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const Core = require("../src/domain/core9.js");
const DiaryCore = require("../scripts/diary-core.js");

const ROOT = path.resolve(__dirname, "../..");
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));

const SCHEMA = readJson("contracts/analysis.schema.json");
const META = SCHEMA["x-cardex-contract"];

const TAXONOMY_VERSION = META.taxonomy_version;
const CARD_POLICY_VERSION = META.card_policy_version;
const EMOTION_IDS = META.emotions.map((e) => e.id);
const SUM_TOLERANCE = META.probability_sum_tolerance;
const TEXT_MAX_CODE_POINTS = META.text_max_code_points;

const ONE_THIRD = 1 / 3;
const TWO_THIRDS = 2 / 3;

function validateProbabilitiesStrict(probabilities) {
  if (!probabilities || typeof probabilities !== "object" || Array.isArray(probabilities)) {
    throw Object.assign(new Error("probabilities must be an object"), { code: "key_mismatch" });
  }
  const keys = Object.keys(probabilities);
  if (keys.length !== EMOTION_IDS.length || !EMOTION_IDS.every((id) => Object.hasOwn(probabilities, id))) {
    throw Object.assign(new Error("probabilities keys do not match 10 emotion IDs"), { code: "key_mismatch" });
  }
  for (const id of EMOTION_IDS) {
    const val = probabilities[id];
    if (typeof val !== "number" || !Number.isFinite(val)) {
      throw Object.assign(new Error(`${id} must be a finite number`), { code: "non_finite_number" });
    }
    if (val < 0 || val > 1) {
      throw Object.assign(new Error(`${id} must be within [0, 1]`), { code: "out_of_range" });
    }
  }
  const total = EMOTION_IDS.reduce((acc, id) => acc + probabilities[id], 0);
  if (Math.abs(total - 1) > SUM_TOLERANCE) {
    throw Object.assign(new Error("probability sum deviates from 1.0 beyond 1e-6"), { code: "invalid_sum" });
  }
  return probabilities;
}

function evaluateCard(probabilities) {
  const probs = validateProbabilitiesStrict(probabilities);
  const dominantRatio = Math.max(...EMOTION_IDS.map((id) => probs[id]));
  let stage;
  if (dominantRatio > TWO_THIRDS) stage = 3;
  else if (dominantRatio > ONE_THIRD) stage = 2;
  else if (dominantRatio > 0) stage = 1;
  else throw Object.assign(new Error("dominant_ratio must be > 0"), { code: "invalid_sum" });

  const ties = EMOTION_IDS.filter((id) => probs[id] === dominantRatio);
  const dominantEmotion = ties[0];
  return {
    dominant_emotion: dominantEmotion,
    dominant_ratio: dominantRatio,
    ties,
    card_stage: stage,
    card_key: `${dominantEmotion}:${stage}`,
    card_policy_version: CARD_POLICY_VERSION,
  };
}

function validateAnalysisRecord(analysis) {
  if (!analysis || typeof analysis !== "object") {
    throw Object.assign(new Error("analysis must be an object"), { code: "not_valid_status" });
  }
  if (analysis.status !== "valid") {
    throw Object.assign(new Error("analysis status is not valid"), { code: "not_valid_status" });
  }
  if (analysis.taxonomy_version !== TAXONOMY_VERSION) {
    throw Object.assign(new Error("taxonomy_version mismatch"), { code: "taxonomy_mismatch" });
  }
  if (analysis.truncated === true) {
    throw Object.assign(new Error("truncated analysis cannot issue card"), { code: "truncated_unanalyzable" });
  }
  return evaluateCard(analysis.probabilities);
}

function validateRequest(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("payload must be an object");
  }
  const keys = Object.keys(payload);
  const expected = ["record_id", "version", "request_id", "text"];
  assert.deepEqual([...keys].sort(), [...expected].sort());
  for (const field of ["record_id", "request_id"]) {
    assert.equal(typeof payload[field], "string");
    assert.ok(payload[field].trim().length > 0 && payload[field].length <= 128);
  }
  assert.ok(Number.isInteger(payload.version) && payload.version >= 1);
  assert.equal(typeof payload.text, "string");
  assert.ok(!/\u0000/.test(payload.text));
  assert.ok(payload.text.trim().length > 0);
  const lenState = DiaryCore.lengthState(payload.text);
  assert.ok(lenState.count <= TEXT_MAX_CODE_POINTS);
}

test("schema taxonomy and limit match frontend Core and DiaryCore", () => {
  assert.equal(TAXONOMY_VERSION, Core.TAXONOMY);
  assert.deepEqual(EMOTION_IDS, Core.IDS);
  assert.deepEqual(
    META.parents.map((p) => ({ id: p.id, children: p.children })),
    Core.PARENTS.map((p) => ({ id: p.id, children: p.children })),
  );
  assert.equal(TEXT_MAX_CODE_POINTS, DiaryCore.LIMIT);
  assert.deepEqual(SCHEMA.$defs.EmotionId.enum, Core.IDS);
  assert.deepEqual(SCHEMA.$defs.Probabilities.required, Core.IDS);
});

test("card-boundaries fixture matches strict-gt policy and core.js tie order", () => {
  const fixture = readJson("contracts/fixtures/card-boundaries.json");
  assert.equal(fixture.taxonomy_version, TAXONOMY_VERSION);
  assert.equal(fixture.card_policy_version, CARD_POLICY_VERSION);
  assert.equal(fixture.synthetic, true);

  for (const c of fixture.cases) {
    Core.validateProbabilities(c.probabilities);
    const actual = evaluateCard(c.probabilities);
    for (const [k, expectedVal] of Object.entries(c.expected)) {
      assert.deepEqual(actual[k], expectedVal, `${c.id}.${k}`);
    }
  }
});

test("invalid-distributions fixture rejects invalid probabilities and analyses", () => {
  const fixture = readJson("contracts/fixtures/invalid-distributions.json");
  for (const c of fixture.probability_cases) {
    assert.throws(
      () => evaluateCard(c.probabilities),
      (err) => err && err.code === c.expected_error,
      c.id,
    );
    assert.throws(() => Core.validateProbabilities(c.probabilities), Error, `Core rejects ${c.id}`);
  }
  for (const c of fixture.analysis_cases) {
    assert.throws(
      () => validateAnalysisRecord(c.analysis),
      (err) => err && err.code === c.expected_error,
      c.id,
    );
    assert.throws(() => Core.validateAnalysis(c.analysis), Error, `Core.validateAnalysis rejects ${c.id}`);
  }
});

test("runtime NaN and Infinity probabilities are rejected", () => {
  const base = Object.fromEntries(EMOTION_IDS.map((id) => [id, 0.1]));
  for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    assert.throws(
      () => validateProbabilitiesStrict({ ...base, pos_1: bad }),
      (err) => err && err.code === "non_finite_number",
    );
  }
});

test("api-cases fixture validates request/response/error and code-point boundaries", () => {
  const fixture = readJson("contracts/fixtures/api-cases.json");
  const succRequired = new Set(SCHEMA.$defs.AnalyzeSuccessResponse.required);
  const errRequired = new Set(SCHEMA.$defs.AnalyzeUnissuableResponse.required);

  for (const c of fixture.valid_exchange_cases) {
    validateRequest(c.request);
    assert.ok(!Object.hasOwn(c.response, "text"), `${c.id} must not echo raw text`);
    assert.equal(c.response.record_id, c.request.record_id);
    assert.equal(c.response.version, c.request.version);
    assert.equal(c.response.request_id, c.request.request_id);
    if (c.response.status === "valid") {
      assert.deepEqual(Object.keys(c.response).sort(), [...succRequired].sort());
      const evaluated = evaluateCard(c.response.probabilities);
      assert.equal(c.response.truncated, false);
      assert.equal(c.response.dominant_emotion, evaluated.dominant_emotion);
      assert.equal(c.response.dominant_ratio, evaluated.dominant_ratio);
      assert.deepEqual(c.response.ties, evaluated.ties);
      assert.equal(c.response.card_stage, evaluated.card_stage);
      assert.equal(c.response.card_key, evaluated.card_key);
    } else {
      for (const k of errRequired) assert.ok(Object.hasOwn(c.response, k));
      assert.equal(c.response.card_stage, null);
      assert.equal(c.response.card_key, null);
      assert.deepEqual(c.response.ties, []);
    }
  }

  for (const c of fixture.text_length_boundary_cases) {
    const text = c.repeat_char.repeat(c.repeat_count) + c.suffix;
    assert.equal(DiaryCore.lengthState(text).count, c.expected_code_points, c.id);
    const payload = { record_id: "rec-len", version: 1, request_id: "req-len", text };
    if (c.expected_valid) validateRequest(payload);
    else assert.throws(() => validateRequest(payload));
  }

  for (const c of fixture.invalid_request_cases) {
    assert.equal(c.expected_status, 422);
    assert.throws(() => validateRequest(c.payload), Error, c.id);
  }

  for (const c of fixture.server_error_cases) {
    assert.ok([500, 503].includes(c.expected_status));
    if (c.must_not_be_422) assert.notEqual(c.expected_status, 422);
    assert.ok(c.response.detail);
  }
});

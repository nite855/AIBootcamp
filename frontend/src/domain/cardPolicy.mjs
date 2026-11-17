export const TAXONOMY_VERSION = "emotion-cardex-3plus9-v1";
export const CARD_POLICY_VERSION = "card-stage-strict-gt-v1";
export const STAGE_2_THRESHOLD = 1 / 3;
export const STAGE_3_THRESHOLD = 2 / 3;
export const SUM_TOLERANCE = 1e-6;

export const EMOTION_IDS = Object.freeze([
  "pos_1",
  "pos_2",
  "pos_3",
  "neg_1",
  "neg_2",
  "neg_3",
  "neu_1",
  "neu_2",
  "neu_3",
]);

export const STAGE_LABELS = Object.freeze({
  1: "1/3 이하",
  2: "1/3 초과 · 2/3 이하",
  3: "2/3 초과",
});

export function evaluateCardProbabilities(probabilities, emotionIds = EMOTION_IDS) {
  if (!probabilities || typeof probabilities !== "object" || Array.isArray(probabilities)) {
    throw Object.assign(new Error("9소분류 ID 계약과 일치하지 않습니다."), { code: "key_mismatch" });
  }
  const keys = Object.keys(probabilities);
  if (
    keys.length !== emotionIds.length ||
    !emotionIds.every((id) => Object.hasOwn(probabilities, id))
  ) {
    throw Object.assign(new Error("9소분류 ID 계약과 일치하지 않습니다."), { code: "key_mismatch" });
  }
  for (const id of emotionIds) {
    const val = probabilities[id];
    if (typeof val !== "number" || !Number.isFinite(val)) {
      throw Object.assign(new Error("확률은 0~1의 유한한 숫자여야 합니다."), {
        code: "non_finite_number",
      });
    }
    if (val < 0 || val > 1) {
      throw Object.assign(new Error("확률은 0~1의 유한한 숫자여야 합니다."), {
        code: "out_of_range",
      });
    }
  }
  const total = emotionIds.reduce((acc, id) => acc + probabilities[id], 0);
  if (Math.abs(total - 1) > SUM_TOLERANCE) {
    throw Object.assign(new Error("전체 확률 합계가 1이 아닙니다."), { code: "invalid_sum" });
  }

  const dominantRatio = Math.max(...emotionIds.map((id) => probabilities[id]));
  let stage;
  if (dominantRatio > STAGE_3_THRESHOLD) stage = 3;
  else if (dominantRatio > STAGE_2_THRESHOLD) stage = 2;
  else if (dominantRatio > 0) stage = 1;
  else {
    throw Object.assign(new Error("최대 확률은 0보다 커야 합니다."), { code: "invalid_sum" });
  }

  const ties = emotionIds.filter((id) => probabilities[id] === dominantRatio);
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

export function createDiaryCards(core) {
  const ids = core?.IDS || EMOTION_IDS;

  function resolve(record) {
    if (!record) return { status: "pending", stage: 0 };
    const a = record.analysis;
    if (!a || a.status !== "valid") {
      return { status: a?.status === "error" ? "error" : "pending", stage: 0 };
    }
    if (a.version !== record.version) return { status: "pending", stage: 0 };

    try {
      if (core?.validateAnalysis) core.validateAnalysis(a);
      const evaluated = evaluateCardProbabilities(a.probabilities, ids);
      if (
        a.card_policy_version &&
        a.card_policy_version !== CARD_POLICY_VERSION
      ) {
        return { status: "error", stage: 0 };
      }
      if (
        a.card_stage !== undefined &&
        a.card_stage !== evaluated.card_stage
      ) {
        return { status: "error", stage: 0 };
      }
      if (
        a.card_key !== undefined &&
        a.card_key !== evaluated.card_key
      ) {
        return { status: "error", stage: 0 };
      }
      return {
        recordId: record.id,
        status: "ready",
        type: evaluated.dominant_emotion,
        ties: evaluated.ties,
        score: evaluated.dominant_ratio,
        stage: evaluated.card_stage,
        cardKey: evaluated.card_key,
        cardPolicyVersion: evaluated.card_policy_version,
      };
    } catch {
      return { status: "error", stage: 0 };
    }
  }

  function collection(records) {
    return ids.flatMap((type) =>
      [1, 2, 3].map((stage) => ({
        type,
        stage,
        cardKey: `${type}:${stage}`,
        records: (Array.isArray(records) ? records : [])
          .filter((r) => {
            const c = resolve(r);
            return c.status === "ready" && c.type === type && c.stage === stage;
          })
          .map((r) => r.id),
      })),
    );
  }

  function unlockedKeys(records) {
    return collection(records)
      .filter((s) => s.records.length)
      .map((s) => `${s.type}:${s.stage}`);
  }

  function newlyUnlocked(before, after) {
    const seen = new Set(before || []);
    return (after || []).filter((k) => !seen.has(k));
  }

  return { resolve, collection, unlockedKeys, newlyUnlocked };
}

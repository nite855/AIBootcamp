"""Card stage, representative emotion, tie-breaking, and card-key policy (CARD-01)."""

from backend.app.ml.intake import EMOTION_IDS, ModelIntakeError, validate_probabilities

CARD_POLICY_VERSION = "card-stage-strict-gt-v1"
STAGE_2_THRESHOLD = 1.0 / 3.0
STAGE_3_THRESHOLD = 2.0 / 3.0


def evaluate_card(probabilities: object) -> dict[str, object]:
    """Evaluate dominant emotion, ties, strict-gt card stage (1..3), and card key.

    Rules (contracts/analysis.schema.json):
    - Validate all 9 emotion probabilities (finite non-bool within [0, 1], sum 1 ± 1e-6).
    - p = max(probabilities).
    - Strict greater-than order: p > 2/3 -> 3, p > 1/3 -> 2, p > 0 -> 1.
    - p == 0 (all zero) is rejected as invalid_sum and never receives a card.
    - Ties preserve exact EMOTION_IDS order with exact float equality to p.
    """
    probs = validate_probabilities(probabilities)
    dominant_ratio = max(probs.values())

    if dominant_ratio > STAGE_3_THRESHOLD:
        stage = 3
    elif dominant_ratio > STAGE_2_THRESHOLD:
        stage = 2
    elif dominant_ratio > 0.0:
        stage = 1
    else:
        raise ModelIntakeError("invalid_sum", "dominant_ratio must be > 0")

    ties = [emotion_id for emotion_id in EMOTION_IDS if probs[emotion_id] == dominant_ratio]
    dominant_emotion = ties[0]
    return {
        "dominant_emotion": dominant_emotion,
        "dominant_ratio": dominant_ratio,
        "ties": ties,
        "card_stage": stage,
        "card_key": f"{dominant_emotion}:{stage}",
        "card_policy_version": CARD_POLICY_VERSION,
    }

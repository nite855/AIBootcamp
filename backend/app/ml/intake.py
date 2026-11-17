"""Model intake validation, probability normalization, and hierarchical combination (MODEL-01)."""

import math

TAXONOMY_VERSION = "emotion-cardex-3plus9-v1"
SUM_TOLERANCE = 1e-6

EMOTION_IDS: tuple[str, ...] = (
    "pos_1",
    "pos_2",
    "pos_3",
    "neg_1",
    "neg_2",
    "neg_3",
    "neu_1",
    "neu_2",
    "neu_3",
)

PARENT_CHILDREN: dict[str, tuple[str, ...]] = {
    "positive": ("pos_1", "pos_2", "pos_3"),
    "negative": ("neg_1", "neg_2", "neg_3"),
    "neutral": ("neu_1", "neu_2", "neu_3"),
}

ALLOWED_AGGREGATION_POLICIES = frozenset(
    {
        "direct_record_10class",
        "hierarchical_3plus10",
        "validated_chunk_aggregation",
    }
)
ALLOWED_OUTPUT_KINDS = frozenset({"logits", "probabilities", "hierarchical"})
ALLOWED_TRUNCATION_POLICIES = frozenset({"reject_as_unissuable", "validated_chunk_aggregation"})


class ModelIntakeError(ValueError):
    """Raised when model metadata or model output fails CONTRACT-01 / MODEL-01 gates."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


def validate_probabilities(probabilities: object) -> dict[str, float]:
    """Validate a 9-emotion probability mapping against CONTRACT-01."""
    if not isinstance(probabilities, dict):
        raise ModelIntakeError("key_mismatch", "probabilities must be a mapping")
    if set(probabilities.keys()) != set(EMOTION_IDS) or len(probabilities) != len(EMOTION_IDS):
        raise ModelIntakeError("key_mismatch", "probabilities keys do not match 9 emotion IDs")

    normalized: dict[str, float] = {}
    for emotion_id in EMOTION_IDS:
        value = probabilities[emotion_id]
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
            raise ModelIntakeError("non_finite_number", f"{emotion_id} must be a finite number")
        fval = float(value)
        if fval < 0.0 or fval > 1.0:
            raise ModelIntakeError("out_of_range", f"{emotion_id} must be within [0, 1]")
        normalized[emotion_id] = fval

    if abs(sum(normalized.values()) - 1.0) > SUM_TOLERANCE:
        raise ModelIntakeError("invalid_sum", "probability sum deviates from 1.0 beyond 1e-6")
    return normalized


def validate_intake_manifest(manifest: object) -> None:
    """Validate a candidate model's intake metadata before allowing MODEL-02 serving."""
    if not isinstance(manifest, dict):
        raise ModelIntakeError("invalid_manifest", "manifest must be a mapping")

    if manifest.get("taxonomy_version") != TAXONOMY_VERSION:
        raise ModelIntakeError("taxonomy_mismatch", "taxonomy_version must match emotion-cardex-3plus9-v1")

    model_version = manifest.get("model_version")
    if not isinstance(model_version, str) or not model_version.strip():
        raise ModelIntakeError("missing_model_version", "model_version is required")

    if manifest.get("trust_remote_code") is not False:
        raise ModelIntakeError("unsafe_remote_code", "trust_remote_code must be False")

    if manifest.get("local_files_only") is not True:
        raise ModelIntakeError("offline_required", "local_files_only must be True")

    output_kind = manifest.get("output_kind")
    if output_kind not in ALLOWED_OUTPUT_KINDS:
        raise ModelIntakeError("invalid_output_kind", f"unsupported output_kind: {output_kind}")

    agg = manifest.get("aggregation_policy")
    if agg not in ALLOWED_AGGREGATION_POLICIES:
        raise ModelIntakeError("invalid_aggregation_policy", f"unsupported aggregation_policy: {agg}")

    if agg == "hierarchical_3plus10" and output_kind != "hierarchical":
        raise ModelIntakeError("policy_output_mismatch", "hierarchical_3plus10 requires hierarchical output_kind")

    trunc_policy = manifest.get("truncation_policy")
    if trunc_policy not in ALLOWED_TRUNCATION_POLICIES:
        raise ModelIntakeError("invalid_truncation_policy", f"unsupported truncation_policy: {trunc_policy}")

    max_length = manifest.get("max_length")
    if isinstance(max_length, bool) or not isinstance(max_length, int) or max_length < 16:
        raise ModelIntakeError("invalid_max_length", "max_length must be an integer >= 16")

    id2label = manifest.get("id2label")
    label_map = manifest.get("label_to_emotion_id")
    if not isinstance(id2label, dict) or not id2label:
        raise ModelIntakeError("missing_id2label", "id2label mapping is required")
    if not isinstance(label_map, dict):
        raise ModelIntakeError("missing_label_map", "label_to_emotion_id mapping is required")

    if output_kind in {"logits", "probabilities"}:
        if len(id2label) != len(EMOTION_IDS):
            raise ModelIntakeError("incompatible_label_count", "direct 9-class model must have exactly 9 labels")
        raw_labels = set(id2label.values())
        if set(label_map.keys()) != raw_labels:
            raise ModelIntakeError("label_map_mismatch", "label_to_emotion_id keys must match id2label values")
        mapped_targets = list(label_map.values())
        if len(mapped_targets) != len(EMOTION_IDS) or set(mapped_targets) != set(EMOTION_IDS):
            raise ModelIntakeError("incompatible_taxonomy_mapping", "mapped labels must cover all 9 emotion IDs 1:1")


def _validate_sub_distribution(values: object, expected_keys: tuple[str, ...]) -> dict[str, float]:
    if not isinstance(values, dict) or set(values.keys()) != set(expected_keys):
        raise ModelIntakeError("invalid_hierarchical_keys", f"expected keys {expected_keys}")
    out: dict[str, float] = {}
    for key in expected_keys:
        val = values[key]
        if isinstance(val, bool) or not isinstance(val, (int, float)) or not math.isfinite(val) or val < 0 or val > 1:
            raise ModelIntakeError("invalid_probability_value", f"invalid value for {key}")
        out[key] = float(val)
    if abs(sum(out.values()) - 1.0) > SUM_TOLERANCE:
        raise ModelIntakeError("invalid_hierarchical_sum", "sub-distribution must sum to 1 within 1e-6")
    return out


def combine_hierarchical_3plus10(
    parent_probs: object,
    conditional_children: object,
) -> dict[str, float]:
    """Combine 3 parent probabilities and per-parent conditional distributions into 10 emotions."""
    parents = _validate_sub_distribution(parent_probs, ("positive", "negative", "neutral"))
    if not isinstance(conditional_children, dict):
        raise ModelIntakeError("invalid_hierarchical_keys", "conditional_children must be a mapping")

    combined: dict[str, float] = {}
    for parent_id, children_ids in PARENT_CHILDREN.items():
        cond = _validate_sub_distribution(conditional_children.get(parent_id), children_ids)
        for child_id in children_ids:
            combined[child_id] = parents[parent_id] * cond[child_id]

    return validate_probabilities(combined)


def normalize_direct_output(values: list[float], output_kind: str, index_to_emotion_id: list[str]) -> dict[str, float]:
    """Apply softmax ONLY to raw logits; never apply a second softmax to probabilities."""
    if len(values) != len(EMOTION_IDS) or len(index_to_emotion_id) != len(EMOTION_IDS):
        raise ModelIntakeError("incompatible_label_count", "expected 9 outputs")
    if any(isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v) for v in values):
        raise ModelIntakeError("non_finite_output", "model output contains non-finite value")

    if output_kind == "logits":
        max_v = max(values)
        exps = [math.exp(v - max_v) for v in values]
        denom = sum(exps)
        probs = [e / denom for e in exps]
    elif output_kind == "probabilities":
        probs = [float(v) for v in values]
    else:
        raise ModelIntakeError("invalid_output_kind", f"unexpected direct output_kind: {output_kind}")

    mapped = {emotion_id: prob for emotion_id, prob in zip(index_to_emotion_id, probs)}
    return validate_probabilities(mapped)

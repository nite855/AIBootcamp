"""Contract for 3-parent and 7-child diary emotion probabilities. No model inference."""
import math

TAXONOMY_VERSION = "diary-hierarchical-3x7-v1"
PARENTS = ("positive", "negative", "neutral")
POSITIVE = ("pos_1", "pos_2", "pos_3")
NEGATIVE = ("neg_1", "neg_2", "neg_3")
LABELS = {"pos_1": "기쁨", "pos_2": "만족", "pos_3": "평온", "neg_1": "슬픔", "neg_2": "분노", "neg_3": "불안", "neutral": "중립"}


def _validate_distribution(values, keys):
    if not isinstance(values, dict) or set(values) != set(keys):
        raise ValueError("확률 항목이 올바르지 않습니다.")
    for value in values.values():
        if isinstance(value, bool) or not isinstance(value, (float, int)) or not math.isfinite(value) or not 0 <= value <= 1:
            raise ValueError("확률은 0 이상 1 이하의 유한한 숫자여야 합니다.")
    if not math.isclose(sum(values.values()), 1.0, abs_tol=1e-6):
        raise ValueError("확률의 합은 1이어야 합니다.")


def combine(parent, positive_conditional, negative_conditional):
    """Combine both branch conditional distributions; never invent missing results."""
    _validate_distribution(parent, PARENTS)
    _validate_distribution(positive_conditional, POSITIVE)
    _validate_distribution(negative_conditional, NEGATIVE)
    children = {key: parent["positive"] * positive_conditional[key] for key in POSITIVE}
    children.update({key: parent["negative"] * negative_conditional[key] for key in NEGATIVE})
    children["neutral"] = parent["neutral"]
    return {"taxonomy_version": TAXONOMY_VERSION, "parents": dict(parent), "probabilities": children,
            "representative_parent": max(PARENTS, key=parent.get),
            "top_subcategory": max(LABELS, key=children.get)}

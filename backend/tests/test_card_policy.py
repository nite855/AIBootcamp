"""Unit tests for backend.app.services.card_policy (CARD-01)."""

import json
import math
import unittest
from pathlib import Path

from backend.app.ml.intake import EMOTION_IDS, ModelIntakeError
from backend.app.services.card_policy import (
    CARD_POLICY_VERSION,
    STAGE_2_THRESHOLD,
    STAGE_3_THRESHOLD,
    evaluate_card,
)

ROOT = Path(__file__).resolve().parents[2]
FIXTURES_DIR = ROOT / "contracts" / "fixtures"


class CardPolicyTests(unittest.TestCase):
    def test_constants_use_exact_numeric_fractions(self) -> None:
        self.assertEqual(CARD_POLICY_VERSION, "card-stage-strict-gt-v1")
        self.assertEqual(STAGE_2_THRESHOLD, 1.0 / 3.0)
        self.assertEqual(STAGE_3_THRESHOLD, 2.0 / 3.0)

    def test_boundary_and_tie_fixtures(self) -> None:
        data = json.loads((FIXTURES_DIR / "card-boundaries.json").read_text(encoding="utf-8"))
        for case in data["cases"]:
            with self.subTest(case=case["id"]):
                result = evaluate_card(case["probabilities"])
                self.assertEqual(result["card_policy_version"], CARD_POLICY_VERSION)
                for key, expected in case["expected"].items():
                    self.assertEqual(result[key], expected)

    def test_invalid_distributions_are_rejected(self) -> None:
        data = json.loads((FIXTURES_DIR / "invalid-distributions.json").read_text(encoding="utf-8"))
        for case in data["probability_cases"]:
            with self.subTest(case=case["id"]):
                with self.assertRaises(ModelIntakeError) as ctx:
                    evaluate_card(case["probabilities"])
                self.assertEqual(ctx.exception.code, case["expected_error"])

    def test_non_finite_values_rejected(self) -> None:
        base = {eid: 0.1 for eid in EMOTION_IDS}
        for bad in (math.nan, math.inf, -math.inf):
            with self.assertRaises(ModelIntakeError):
                evaluate_card({**base, "neu_3": bad})


if __name__ == "__main__":
    unittest.main()

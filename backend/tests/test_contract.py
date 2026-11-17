"""Cross-language verification of contracts/analysis.schema.json and contracts/fixtures/."""

import json
import math
import unittest
from pathlib import Path

from backend.app.ml.intake import ModelIntakeError, validate_probabilities
from backend.app.services.card_policy import CARD_POLICY_VERSION, evaluate_card

ROOT = Path(__file__).resolve().parents[2]
CONTRACTS_DIR = ROOT / "contracts"
FIXTURES_DIR = CONTRACTS_DIR / "fixtures"

SCHEMA = json.loads((CONTRACTS_DIR / "analysis.schema.json").read_text(encoding="utf-8"))
META = SCHEMA["x-cardex-contract"]

TAXONOMY_VERSION = META["taxonomy_version"]
EMOTION_IDS = tuple(item["id"] for item in META["emotions"])
TEXT_MAX_CODE_POINTS = int(META["text_max_code_points"])


class ContractValidationError(ValueError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


def validate_analysis_record(analysis: object) -> dict[str, object]:
    if not isinstance(analysis, dict):
        raise ContractValidationError("not_valid_status", "analysis must be an object")
    if analysis.get("status") != "valid":
        raise ContractValidationError("not_valid_status", "analysis status is not valid")
    if analysis.get("taxonomy_version") != TAXONOMY_VERSION:
        raise ContractValidationError("taxonomy_mismatch", "taxonomy_version mismatch")
    if analysis.get("truncated") is True:
        raise ContractValidationError("truncated_unanalyzable", "truncated analysis cannot issue card")
    return evaluate_card(analysis.get("probabilities"))


def validate_request(payload: object) -> None:
    if not isinstance(payload, dict):
        raise ContractValidationError("invalid_payload", "payload must be an object")
    expected_keys = {"record_id", "version", "request_id", "text"}
    if set(payload.keys()) != expected_keys:
        raise ContractValidationError("invalid_keys", "request keys mismatch")
    for field in ("record_id", "request_id"):
        val = payload[field]
        if not isinstance(val, str) or not val.strip() or len(val) > 128:
            raise ContractValidationError("invalid_field", f"invalid {field}")
    version = payload["version"]
    if isinstance(version, bool) or not isinstance(version, int) or version < 1:
        raise ContractValidationError("invalid_version", "version must be integer >= 1")
    text = payload["text"]
    if not isinstance(text, str) or "\x00" in text or not text.strip():
        raise ContractValidationError("invalid_text", "text must be non-empty without null bytes")
    if len(text) > TEXT_MAX_CODE_POINTS:
        raise ContractValidationError("text_too_long", "text exceeds 10,000 code points")


class ContractSchemaAndFixturesTests(unittest.TestCase):
    def test_schema_metadata_and_enum_order(self) -> None:
        self.assertEqual(TAXONOMY_VERSION, "emotion-cardex-3plus9-v1")
        self.assertEqual(CARD_POLICY_VERSION, "card-stage-strict-gt-v1")
        self.assertEqual(TEXT_MAX_CODE_POINTS, 10000)
        self.assertEqual(
            EMOTION_IDS,
            ("pos_1", "pos_2", "pos_3", "neg_1", "neg_2", "neg_3", "neu_1", "neu_2", "neu_3"),
        )
        self.assertEqual(
            tuple(SCHEMA["$defs"]["EmotionId"]["enum"]),
            EMOTION_IDS,
        )
        self.assertEqual(
            tuple(SCHEMA["$defs"]["Probabilities"]["required"]),
            EMOTION_IDS,
        )

    def test_card_boundaries_and_ties_fixtures(self) -> None:
        fixture = json.loads((FIXTURES_DIR / "card-boundaries.json").read_text(encoding="utf-8"))
        self.assertEqual(fixture["taxonomy_version"], TAXONOMY_VERSION)
        self.assertEqual(fixture["card_policy_version"], CARD_POLICY_VERSION)
        self.assertTrue(fixture["synthetic"])

        for case in fixture["cases"]:
            with self.subTest(case=case["id"]):
                actual = evaluate_card(case["probabilities"])
                for key, expected_val in case["expected"].items():
                    self.assertEqual(actual[key], expected_val)

    def test_invalid_distributions_and_analysis_fixtures(self) -> None:
        fixture = json.loads((FIXTURES_DIR / "invalid-distributions.json").read_text(encoding="utf-8"))
        for case in fixture["probability_cases"]:
            with self.subTest(case=case["id"]):
                with self.assertRaises(ModelIntakeError) as ctx:
                    evaluate_card(case["probabilities"])
                self.assertEqual(ctx.exception.code, case["expected_error"])

        for case in fixture["analysis_cases"]:
            with self.subTest(case=case["id"]):
                with self.assertRaises((ContractValidationError, ModelIntakeError)) as ctx:
                    validate_analysis_record(case["analysis"])
                self.assertEqual(ctx.exception.code, case["expected_error"])

    def test_runtime_nan_and_inf_are_rejected(self) -> None:
        base = {k: 0.1 for k in EMOTION_IDS}
        for bad in (math.nan, math.inf, -math.inf):
            mutated = {**base, "pos_1": bad}
            with self.assertRaises(ModelIntakeError) as ctx:
                validate_probabilities(mutated)
            self.assertEqual(ctx.exception.code, "non_finite_number")

    def test_api_cases_fixtures(self) -> None:
        fixture = json.loads((FIXTURES_DIR / "api-cases.json").read_text(encoding="utf-8"))
        req_required = set(SCHEMA["$defs"]["AnalyzeRequest"]["required"])
        succ_required = set(SCHEMA["$defs"]["AnalyzeSuccessResponse"]["required"])
        err_required = set(SCHEMA["$defs"]["AnalyzeUnissuableResponse"]["required"])

        for case in fixture["valid_exchange_cases"]:
            with self.subTest(case=case["id"]):
                req = case["request"]
                resp = case["response"]
                self.assertEqual(set(req.keys()), req_required)
                validate_request(req)
                self.assertNotIn("text", resp)
                self.assertEqual(resp["record_id"], req["record_id"])
                self.assertEqual(resp["version"], req["version"])
                self.assertEqual(resp["request_id"], req["request_id"])
                if resp["status"] == "valid":
                    self.assertEqual(set(resp.keys()), succ_required)
                    evaluated = evaluate_card(resp["probabilities"])
                    self.assertFalse(resp["truncated"])
                    self.assertEqual(resp["dominant_emotion"], evaluated["dominant_emotion"])
                    self.assertEqual(resp["dominant_ratio"], evaluated["dominant_ratio"])
                    self.assertEqual(resp["ties"], evaluated["ties"])
                    self.assertEqual(resp["card_stage"], evaluated["card_stage"])
                    self.assertEqual(resp["card_key"], evaluated["card_key"])
                else:
                    self.assertTrue(err_required.issubset(resp.keys()))
                    self.assertIsNone(resp["card_stage"])
                    self.assertIsNone(resp["card_key"])
                    self.assertEqual(resp["ties"], [])

        for case in fixture["text_length_boundary_cases"]:
            with self.subTest(case=case["id"]):
                text = case["repeat_char"] * case["repeat_count"] + case["suffix"]
                self.assertEqual(len(text), case["expected_code_points"])
                payload = {
                    "record_id": "rec-len",
                    "version": 1,
                    "request_id": "req-len",
                    "text": text,
                }
                if case["expected_valid"]:
                    validate_request(payload)
                else:
                    with self.assertRaises(ContractValidationError):
                        validate_request(payload)

        for case in fixture["invalid_request_cases"]:
            with self.subTest(case=case["id"]):
                self.assertEqual(case["expected_status"], 422)
                with self.assertRaises(ContractValidationError):
                    validate_request(case["payload"])

        for case in fixture["server_error_cases"]:
            with self.subTest(case=case["id"]):
                self.assertIn(case["expected_status"], (500, 503))
                if case.get("must_not_be_422"):
                    self.assertNotEqual(case["expected_status"], 422)
                self.assertIn("detail", case["response"])


if __name__ == "__main__":
    unittest.main()

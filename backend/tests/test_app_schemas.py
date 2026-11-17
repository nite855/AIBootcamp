"""Unit tests for backend.app.schemas.analysis against contracts/fixtures/api-cases.json."""

import json
import unittest
from pathlib import Path

from pydantic import ValidationError

from backend.app.schemas.analysis import (
    AnalyzeRequest,
    AnalyzeSuccessResponse,
    AnalyzeUnissuableResponse,
    ErrorResponse,
)

ROOT = Path(__file__).resolve().parents[2]
API_CASES_PATH = ROOT / "contracts" / "fixtures" / "api-cases.json"


class AppSchemaTests(unittest.TestCase):
    def test_api_cases_validate_against_pydantic_models(self) -> None:
        fixture = json.loads(API_CASES_PATH.read_text(encoding="utf-8"))

        for case in fixture["valid_exchange_cases"]:
            with self.subTest(case=case["id"]):
                req = AnalyzeRequest.model_validate(case["request"])
                self.assertEqual(req.record_id, case["request"]["record_id"])
                if case["response"]["status"] == "valid":
                    resp = AnalyzeSuccessResponse.model_validate(case["response"])
                    self.assertEqual(resp.card_key, case["response"]["card_key"])
                else:
                    resp = AnalyzeUnissuableResponse.model_validate(case["response"])
                    self.assertIsNone(resp.card_stage)
                    self.assertIsNone(resp.card_key)

        for case in fixture["text_length_boundary_cases"]:
            with self.subTest(case=case["id"]):
                text = case["repeat_char"] * case["repeat_count"] + case["suffix"]
                payload = {
                    "record_id": "rec-len",
                    "version": 1,
                    "request_id": "req-len",
                    "text": text,
                }
                if case["expected_valid"]:
                    req = AnalyzeRequest.model_validate(payload)
                    self.assertEqual(len(req.text), case["expected_code_points"])
                else:
                    with self.assertRaises(ValidationError):
                        AnalyzeRequest.model_validate(payload)

        for case in fixture["invalid_request_cases"]:
            with self.subTest(case=case["id"]):
                with self.assertRaises(ValidationError):
                    AnalyzeRequest.model_validate(case["payload"])

        for case in fixture["server_error_cases"]:
            with self.subTest(case=case["id"]):
                err = ErrorResponse.model_validate(case["response"])
                self.assertEqual(err.code, case["response"]["code"])

    def test_boolean_version_is_rejected_by_strict_int(self) -> None:
        with self.assertRaises(ValidationError):
            AnalyzeRequest.model_validate(
                {
                    "record_id": "rec-1",
                    "version": True,
                    "request_id": "req-1",
                    "text": "오늘의 기록",
                }
            )


if __name__ == "__main__":
    unittest.main()

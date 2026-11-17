"""Unit tests for backend.app.services.validation (migrated & extended from tests/services/)."""

import unittest

from backend.app.services.validation import (
    TEXT_MAX_CODE_POINTS,
    validate_non_empty_identifier,
    validate_record_text,
)


class AppValidationTests(unittest.TestCase):
    def test_accepts_valid_text_up_to_10000_code_points(self) -> None:
        exact = "가" * (TEXT_MAX_CODE_POINTS - 1) + "😊"
        self.assertEqual(len(exact), TEXT_MAX_CODE_POINTS)
        self.assertEqual(validate_record_text(exact), exact)

    def test_rejects_over_10000_code_points_without_truncation(self) -> None:
        with self.assertRaisesRegex(ValueError, "10,000자"):
            validate_record_text("가" * (TEXT_MAX_CODE_POINTS + 1))

    def test_rejects_blank_or_whitespace_only_text(self) -> None:
        for bad in ("", "   ", "\n\t\r "):
            with self.subTest(bad=repr(bad)):
                with self.assertRaisesRegex(ValueError, "문장을 입력"):
                    validate_record_text(bad)

    def test_rejects_null_bytes_in_text_or_identifier(self) -> None:
        with self.assertRaisesRegex(ValueError, "읽을 수 없는 문자"):
            validate_record_text("오늘\x00기록")
        with self.assertRaises(ValueError):
            validate_non_empty_identifier("rec\x001")
        with self.assertRaises(ValueError):
            validate_non_empty_identifier("   ")


if __name__ == "__main__":
    unittest.main()

import csv
import tempfile
import unittest
from pathlib import Path

from emotion_service.predictor import _clean_utterances, resolve_checkpoint, select_checkpoint


class EmotionModelPathTests(unittest.TestCase):
    def test_selects_best_validation_checkpoint(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            study = Path(temporary_directory)
            rows = [
                {
                    "condition": "lower",
                    "seed": "17",
                    "split": "validation_fixed",
                    "negative_macro_f1": "0.5",
                },
                {
                    "condition": "best",
                    "seed": "42",
                    "split": "validation_fixed",
                    "negative_macro_f1": "0.8",
                },
            ]
            with (study / "study_runs.csv").open("w", encoding="utf-8", newline="") as stream:
                writer = csv.DictWriter(stream, fieldnames=rows[0])
                writer.writeheader()
                writer.writerows(rows)

            checkpoint = (
                study
                / "best"
                / "emotional_dialogue"
                / "kcelectra"
                / "finetune"
                / "seed-42"
                / "checkpoint"
            )
            checkpoint.mkdir(parents=True)
            for name in ("config.json", "model.safetensors", "tokenizer_config.json"):
                (checkpoint / name).touch()

            self.assertEqual(select_checkpoint(study), checkpoint.resolve())

    def test_direct_checkpoint_takes_precedence(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            checkpoint = Path(temporary_directory)
            for name in ("config.json", "model.safetensors", "tokenizer_config.json"):
                (checkpoint / name).touch()

            self.assertEqual(resolve_checkpoint(checkpoint, "missing"), checkpoint.resolve())


class EmotionInputTests(unittest.TestCase):
    def test_cleans_whitespace(self) -> None:
        self.assertEqual(_clean_utterances("  오늘은\n 행복해  "), ["오늘은 행복해"])

    def test_rejects_empty_utterance(self) -> None:
        with self.assertRaises(ValueError):
            _clean_utterances("   ")

    def test_rejects_more_than_three_utterances(self) -> None:
        with self.assertRaises(ValueError):
            _clean_utterances(["하나", "둘", "셋", "넷"])


if __name__ == "__main__":
    unittest.main()

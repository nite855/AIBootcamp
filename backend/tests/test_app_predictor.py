"""Unit tests for unified backend.app.ml.predictor path and input rules."""

import csv
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from backend.app.ml.predictor import (
    ROOT,
    STUDY_NAME,
    _clean_utterances,
    _default_study_dir,
    resolve_checkpoint,
    select_checkpoint,
)


class AppPredictorPathTests(unittest.TestCase):
    def test_root_is_repository_root(self) -> None:
        self.assertEqual(ROOT, Path(__file__).resolve().parents[2])

    def test_production_resolve_disallows_auto_discovery_without_env(self) -> None:
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaisesRegex(FileNotFoundError, "명시된 모델 경로"):
                resolve_checkpoint(allow_auto_discovery=False)

    def test_auto_discovery_finds_colocated_study_when_opted_in(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory) / "repository"
            study = root / STUDY_NAME
            study.mkdir(parents=True)
            (study / "study_runs.csv").touch()
            with patch("backend.app.ml.predictor.ROOT", root):
                self.assertEqual(_default_study_dir(), study)

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


class AppPredictorInputTests(unittest.TestCase):
    def test_cleans_whitespace_and_validates_utterances(self) -> None:
        self.assertEqual(_clean_utterances("  오늘은\n 행복해  "), ["오늘은 행복해"])
        with self.assertRaises(ValueError):
            _clean_utterances("   ")
        with self.assertRaises(ValueError):
            _clean_utterances(["하나", "둘", "셋", "넷"])


if __name__ == "__main__":
    unittest.main()

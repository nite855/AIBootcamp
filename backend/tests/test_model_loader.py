"""Unit tests for MODEL-02 intake-gated loader, truncation handling, and explicit contract mock."""

import json
import os
import sys
import tempfile
import types
import unittest
from pathlib import Path
from unittest.mock import patch

from backend.app.ml.intake import EMOTION_IDS, ModelIntakeError, TAXONOMY_VERSION
from backend.app.ml.predictor import (
    ContractMockPredictor,
    RecordEmotionPredictor,
    create_predictor,
    load_and_verify_manifest,
)
from backend.app.services.card_policy import evaluate_card

ROOT = Path(__file__).resolve().parents[2]
LEGACY_CHECKPOINT = ROOT / "models" / "emotion-kcelectra" / "checkpoint"


def _write_valid_checkpoint_dir(directory: Path, *, output_kind: str = "logits", max_length: int = 32) -> None:
    id2label = {str(i): f"LBL_{eid}" for i, eid in enumerate(EMOTION_IDS)}
    label_to_emotion_id = {f"LBL_{eid}": eid for eid in EMOTION_IDS}
    (directory / "config.json").write_text(json.dumps({"id2label": id2label}), encoding="utf-8")
    (directory / "model.safetensors").write_bytes(b"")
    (directory / "tokenizer_config.json").write_text("{}", encoding="utf-8")
    manifest = {
        "model_version": "test-10class-v1",
        "taxonomy_version": TAXONOMY_VERSION,
        "output_kind": output_kind,
        "aggregation_policy": "direct_record_10class",
        "truncation_policy": "reject_as_unissuable",
        "max_length": max_length,
        "local_files_only": True,
        "trust_remote_code": False,
        "id2label": id2label,
        "label_to_emotion_id": label_to_emotion_id,
    }
    (directory / "model_manifest.json").write_text(json.dumps(manifest), encoding="utf-8")


class ModelLoaderTests(unittest.TestCase):
    def test_rejects_legacy_6_label_checkpoint(self) -> None:
        if LEGACY_CHECKPOINT.is_dir():
            with self.assertRaises(ModelIntakeError) as ctx:
                load_and_verify_manifest(LEGACY_CHECKPOINT)
            self.assertEqual(ctx.exception.code, "incompatible_label_count")

        with tempfile.TemporaryDirectory() as tmp:
            ckpt = Path(tmp)
            (ckpt / "config.json").write_text(
                json.dumps({"id2label": {"0": "분노", "1": "기쁨"}}), encoding="utf-8"
            )
            with self.assertRaises(ModelIntakeError) as ctx:
                load_and_verify_manifest(ckpt)
            self.assertEqual(ctx.exception.code, "incompatible_label_count")

    def test_rejects_id2label_mismatch_between_config_and_manifest(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            ckpt = Path(tmp)
            _write_valid_checkpoint_dir(ckpt)
            cfg = json.loads((ckpt / "config.json").read_text(encoding="utf-8"))
            cfg["id2label"]["0"] = "TAMPERED"
            (ckpt / "config.json").write_text(json.dumps(cfg), encoding="utf-8")
            with self.assertRaises(ModelIntakeError) as ctx:
                load_and_verify_manifest(ckpt)
            self.assertEqual(ctx.exception.code, "id2label_mismatch")

    def test_create_predictor_requires_model_unless_explicit_mock_mode(self) -> None:
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(FileNotFoundError):
                create_predictor()

        with patch.dict(os.environ, {"EMOTION_MOCK_MODE": "1"}, clear=True):
            predictor = create_predictor()
            self.assertIsInstance(predictor, ContractMockPredictor)
            res = predictor.predict_record("MODEL-02 합성 테스트 문장입니다.")
            self.assertEqual(res["model_version"], "contract-mock-v1")
            self.assertFalse(res["truncated"])
            card = evaluate_card(res["probabilities"])
            self.assertIn(card["card_stage"], (1, 2, 3))

    def test_record_predictor_handles_logits_probabilities_and_truncation(self) -> None:
        captured_options: list[dict[str, object]] = []

        class FakeTensor:
            def __init__(self, data: list[float]) -> None:
                self._data = data

            def __getitem__(self, _idx: int) -> "FakeTensor":
                return self

            def float(self) -> "FakeTensor":
                return self

            def cpu(self) -> "FakeTensor":
                return self

            def tolist(self) -> list[float]:
                return list(self._data)

        class FakeBatch(dict):
            def to(self, _device: str) -> "FakeBatch":
                return self

        class FakeInferenceMode:
            def __enter__(self) -> None:
                return None

            def __exit__(self, *_args: object) -> None:
                return None

        fake_torch = types.ModuleType("torch")
        fake_torch.set_num_threads = lambda _n: None
        fake_torch.cuda = types.SimpleNamespace(is_available=lambda: False)
        fake_torch.inference_mode = FakeInferenceMode

        class FakeTokenizer:
            @classmethod
            def from_pretrained(cls, _path: Path, **kwargs: object) -> "FakeTokenizer":
                captured_options.append(kwargs)
                return cls()

            def __call__(self, text: str, **_kwargs: object) -> FakeBatch:
                tokens = [1] * (40 if text == "TOO_LONG" else 6)
                return FakeBatch({"input_ids": tokens})

        class FakeModel:
            output_values = [2.0] + [0.0] * 9

            @classmethod
            def from_pretrained(cls, _path: Path, **kwargs: object) -> "FakeModel":
                captured_options.append(kwargs)
                return cls()

            def to(self, _device: str) -> "FakeModel":
                return self

            def eval(self) -> "FakeModel":
                return self

            def __call__(self, **_kwargs: object) -> object:
                return types.SimpleNamespace(logits=FakeTensor(self.output_values))

        fake_transformers = types.ModuleType("transformers")
        fake_transformers.AutoTokenizer = FakeTokenizer
        fake_transformers.AutoModelForSequenceClassification = FakeModel

        with tempfile.TemporaryDirectory() as tmp:
            ckpt = Path(tmp)
            _write_valid_checkpoint_dir(ckpt, output_kind="logits", max_length=16)
            with patch.dict(sys.modules, {"torch": fake_torch, "transformers": fake_transformers}):
                predictor = RecordEmotionPredictor(checkpoint=ckpt, device="cpu")

                self.assertEqual(predictor.model_version, "test-10class-v1")
                self.assertTrue(
                    all(
                        opt.get("local_files_only") is True and opt.get("trust_remote_code") is False
                        for opt in captured_options
                    )
                )

                ok_res = predictor.predict_record("짧은 기록")
                self.assertFalse(ok_res["truncated"])
                self.assertEqual(ok_res["input_tokens"], 6)
                card = evaluate_card(ok_res["probabilities"])
                self.assertEqual(card["dominant_emotion"], "pos_1")

                trunc_res = predictor.predict_record("TOO_LONG")
                self.assertTrue(trunc_res["truncated"])
                self.assertIsNone(trunc_res["probabilities"])
                self.assertEqual(trunc_res["input_tokens"], 40)

            # Verify probabilities mode does NOT apply a second softmax
            _write_valid_checkpoint_dir(ckpt, output_kind="probabilities", max_length=16)
            FakeModel.output_values = [0.55] + [0.05] * 9
            with patch.dict(sys.modules, {"torch": fake_torch, "transformers": fake_transformers}):
                prob_predictor = RecordEmotionPredictor(checkpoint=ckpt, device="cpu")
                prob_res = prob_predictor.predict_record("짧은 기록")
                self.assertAlmostEqual(prob_res["probabilities"]["pos_1"], 0.55, places=9)


if __name__ == "__main__":
    unittest.main()

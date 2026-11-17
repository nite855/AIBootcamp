"""Model intake specification, metadata gate, and aggregation-contract checks (MODEL-01)."""

import json
import unittest
from pathlib import Path

from backend.app.ml.intake import (
    ModelIntakeError,
    combine_hierarchical_3plus10,
    normalize_direct_output,
    validate_intake_manifest,
)
from backend.tests.test_contract import EMOTION_IDS, TAXONOMY_VERSION

ROOT = Path(__file__).resolve().parents[2]
SAMPLES_PATH = ROOT / "contracts" / "fixtures" / "model-intake-samples.json"
LEGACY_CONFIG_PATH = ROOT / "models" / "emotion-kcelectra" / "checkpoint" / "config.json"


class ModelIntakeTests(unittest.TestCase):
    def _valid_direct_manifest(self) -> dict[str, object]:
        return {
            "model_version": "candidate-3plus10-v1",
            "taxonomy_version": TAXONOMY_VERSION,
            "output_kind": "logits",
            "aggregation_policy": "direct_record_10class",
            "truncation_policy": "reject_as_unissuable",
            "max_length": 512,
            "local_files_only": True,
            "trust_remote_code": False,
            "id2label": {str(i): eid for i, eid in enumerate(EMOTION_IDS)},
            "label_to_emotion_id": {eid: eid for eid in EMOTION_IDS},
        }

    def test_accepts_valid_direct_manifest_and_rejects_legacy_6_labels(self) -> None:
        validate_intake_manifest(self._valid_direct_manifest())

        legacy_manifest = self._valid_direct_manifest()
        legacy_manifest["id2label"] = {
            "0": "분노",
            "1": "슬픔",
            "2": "불안",
            "3": "상처",
            "4": "당황",
            "5": "기쁨",
        }
        legacy_manifest["label_to_emotion_id"] = {
            "분노": "neg_3",
            "슬픔": "neg_2",
            "불안": "neg_1",
            "상처": "neg_2",
            "당황": "neu_4",
            "기쁨": "pos_1",
        }
        with self.assertRaises(ModelIntakeError) as ctx:
            validate_intake_manifest(legacy_manifest)
        self.assertEqual(ctx.exception.code, "incompatible_label_count")

        if LEGACY_CONFIG_PATH.is_file():
            legacy_cfg = json.loads(LEGACY_CONFIG_PATH.read_text(encoding="utf-8"))
            real_check = self._valid_direct_manifest()
            real_check["id2label"] = legacy_cfg["id2label"]
            with self.assertRaises(ModelIntakeError) as real_ctx:
                validate_intake_manifest(real_check)
            self.assertEqual(real_ctx.exception.code, "incompatible_label_count")

    def test_rejects_incomplete_or_unsafe_intake_manifests(self) -> None:
        bad_trust = self._valid_direct_manifest()
        bad_trust["trust_remote_code"] = True
        with self.assertRaises(ModelIntakeError):
            validate_intake_manifest(bad_trust)

        bad_offline = self._valid_direct_manifest()
        bad_offline["local_files_only"] = False
        with self.assertRaises(ModelIntakeError):
            validate_intake_manifest(bad_offline)

        dup_map = self._valid_direct_manifest()
        dup_map["label_to_emotion_id"] = {eid: ("pos_1" if eid == "pos_2" else eid) for eid in EMOTION_IDS}
        with self.assertRaises(ModelIntakeError) as ctx:
            validate_intake_manifest(dup_map)
        self.assertEqual(ctx.exception.code, "incompatible_taxonomy_mapping")

    def test_hierarchical_3plus10_combines_exact_joint_distribution(self) -> None:
        combined = combine_hierarchical_3plus10(
            {"positive": 0.5, "negative": 0.3, "neutral": 0.2},
            {
                "positive": {"pos_1": 0.6, "pos_2": 0.3, "pos_3": 0.1},
                "negative": {"neg_1": 0.5, "neg_2": 0.3, "neg_3": 0.2},
                "neutral": {"neu_1": 0.4, "neu_2": 0.3, "neu_3": 0.3},
            },
        )
        self.assertAlmostEqual(sum(combined.values()), 1.0, places=9)
        self.assertAlmostEqual(combined["pos_1"], 0.30, places=9)
        self.assertAlmostEqual(combined["neu_1"], 0.08, places=9)

        with self.assertRaises(ModelIntakeError):
            combine_hierarchical_3plus10(
                {"positive": 0.5, "negative": 0.3, "neutral": 0.2},
                {
                    "positive": {"pos_1": 0.6, "pos_2": 0.3, "pos_3": 0.1},
                    "negative": {"neg_1": 0.5, "neg_2": 0.3, "neg_3": 0.2},
                    "neutral": {"neu_1": 0.4, "neu_2": 0.3, "neu_3": 0.2},
                },
            )

    def test_direct_output_distinguishes_logits_from_probabilities(self) -> None:
        logits_probs = normalize_direct_output([2.0] + [0.0] * 8, "logits", list(EMOTION_IDS))
        self.assertAlmostEqual(sum(logits_probs.values()), 1.0, places=9)
        self.assertGreater(logits_probs["pos_1"], 0.4)

        exact_probs = normalize_direct_output([0.6] + [0.05] * 8, "probabilities", list(EMOTION_IDS))
        self.assertAlmostEqual(exact_probs["pos_1"], 0.6, places=9)

        with self.assertRaises(ModelIntakeError):
            normalize_direct_output([2.0] + [0.0] * 8, "probabilities", list(EMOTION_IDS))

    def test_intake_samples_fixture_integrity(self) -> None:
        data = json.loads(SAMPLES_PATH.read_text(encoding="utf-8"))
        self.assertTrue(data["synthetic"])
        self.assertEqual(data["taxonomy_version"], TAXONOMY_VERSION)
        samples = data["samples"]
        self.assertGreaterEqual(len(samples), 12)
        hints = {s["category_hint"] for s in samples if s["category_hint"] is not None}
        self.assertEqual(hints, set(EMOTION_IDS))
        for sample in samples:
            text = sample["text"]
            self.assertIsInstance(text, str)
            self.assertTrue(text.strip())
            self.assertNotIn("\x00", text)
            self.assertLessEqual(len(text), 10000)


if __name__ == "__main__":
    unittest.main()

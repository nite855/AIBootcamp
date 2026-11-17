"""Checkpoint resolution, intake-gated 10-emotion loader, and offline inference for backend.app."""

import argparse
import csv
import hashlib
import json
import os
from pathlib import Path

from backend.app.ml.intake import (
    EMOTION_IDS,
    ModelIntakeError,
    normalize_direct_output,
    validate_intake_manifest,
    validate_probabilities,
)

ROOT = Path(__file__).resolve().parents[3]
STUDY_NAME = "emotional-dialogue-input-study-20261007-v1"
MANIFEST_FILENAME = "model_manifest.json"
REQUIRED_CHECKPOINT_FILES = (
    "config.json",
    "model.safetensors",
    "tokenizer_config.json",
)


class ModelNotReadyError(RuntimeError):
    """Raised when no valid 10-emotion model checkpoint is loaded or available."""


def _default_study_dir() -> Path:
    """Find a colocated study first, then the extracted Downloads artifact (local CLI only)."""
    candidates = [
        ROOT / STUDY_NAME,
        ROOT.parent / "experiments" / STUDY_NAME,
    ]
    downloads = Path.home() / "Downloads"
    if downloads.is_dir():
        candidates.extend(downloads.glob(f"{STUDY_NAME}*/{STUDY_NAME}"))

    return next(
        (candidate for candidate in candidates if (candidate / "study_runs.csv").is_file()),
        candidates[0],
    )


def _validate_checkpoint(checkpoint: Path) -> Path:
    checkpoint = checkpoint.expanduser().resolve()
    missing = [name for name in REQUIRED_CHECKPOINT_FILES if not (checkpoint / name).is_file()]
    if missing:
        names = ", ".join(missing)
        raise FileNotFoundError(f"체크포인트 파일이 없습니다 ({names}): {checkpoint}")
    return checkpoint


def select_checkpoint(study: Path) -> Path:
    """Select the best validation run using the experiment's original metric."""
    runs_path = study.expanduser().resolve() / "study_runs.csv"
    if not runs_path.is_file():
        raise FileNotFoundError(
            "실험 폴더를 찾을 수 없습니다. EMOTION_STUDY_DIR 또는 "
            f"EMOTION_MODEL_DIR를 설정하세요: {runs_path}"
        )

    with runs_path.open(encoding="utf-8-sig", newline="") as stream:
        rows = [row for row in csv.DictReader(stream) if row["split"] == "validation_fixed"]
    if not rows:
        raise ValueError(f"validation_fixed 결과가 없습니다: {runs_path}")

    row = max(rows, key=lambda item: float(item["negative_macro_f1"]))
    checkpoint = (
        runs_path.parent
        / row["condition"]
        / "emotional_dialogue"
        / "kcelectra"
        / "finetune"
        / f"seed-{row['seed']}"
        / "checkpoint"
    )
    return _validate_checkpoint(checkpoint)


def resolve_checkpoint(
    checkpoint: Path | str | None = None,
    study: Path | str | None = None,
    *,
    allow_auto_discovery: bool = False,
) -> Path:
    """Resolve checkpoint path; production server runtime disallows Downloads/study auto-discovery."""
    configured_checkpoint = checkpoint or os.getenv("EMOTION_MODEL_DIR")
    if configured_checkpoint:
        return _validate_checkpoint(Path(configured_checkpoint))

    configured_study = study or os.getenv("EMOTION_STUDY_DIR")
    if configured_study:
        return select_checkpoint(Path(configured_study))

    if allow_auto_discovery:
        return select_checkpoint(_default_study_dir())

    raise FileNotFoundError(
        "EMOTION_MODEL_DIR이 설정되지 않았습니다. 운영 환경에서는 명시된 모델 경로만 사용합니다."
    )


def load_and_verify_manifest(checkpoint: Path) -> dict[str, object]:
    """Load model_manifest.json + config.json and enforce MODEL-01 intake gates."""
    config_path = checkpoint / "config.json"
    if not config_path.is_file():
        raise ModelIntakeError("missing_config", f"config.json이 없습니다: {checkpoint}")
    config_data = json.loads(config_path.read_text(encoding="utf-8"))

    manifest_path = checkpoint / MANIFEST_FILENAME
    if not manifest_path.is_file():
        id2label = config_data.get("id2label")
        if isinstance(id2label, dict) and len(id2label) != len(EMOTION_IDS):
            raise ModelIntakeError(
                "incompatible_label_count",
                f"10감정 모델이 아닙니다 (라벨 {len(id2label)}개). 임의 6→10 변환은 허용되지 않습니다.",
            )
        raise ModelIntakeError(
            "missing_manifest",
            f"MODEL-01 인수 매니페스트({MANIFEST_FILENAME})가 없습니다: {checkpoint}",
        )

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if "id2label" not in manifest and isinstance(config_data.get("id2label"), dict):
        manifest["id2label"] = config_data["id2label"]
    validate_intake_manifest(manifest)

    if isinstance(config_data.get("id2label"), dict) and manifest["id2label"] != config_data["id2label"]:
        raise ModelIntakeError("id2label_mismatch", "config.json과 model_manifest.json의 id2label이 다릅니다.")
    return manifest


def _clean_utterances(utterances: str | list[str]) -> list[str]:
    if isinstance(utterances, str):
        utterances = [utterances]
    if not isinstance(utterances, list) or not 1 <= len(utterances) <= 3:
        raise ValueError("사용자 발화 1~3개를 문자열 목록으로 입력하세요.")

    cleaned = [" ".join(text.split()) if isinstance(text, str) else "" for text in utterances]
    if any(not text for text in cleaned):
        raise ValueError("빈 발화 또는 문자열이 아닌 발화가 있습니다.")
    return cleaned


class RecordEmotionPredictor:
    """Offline HuggingFace sequence-classification loader for validated 10-emotion checkpoints."""

    def __init__(
        self,
        checkpoint: Path | str | None = None,
        device: str = "auto",
    ) -> None:
        for name in ("HF_HUB_OFFLINE", "TRANSFORMERS_OFFLINE", "HF_HUB_DISABLE_TELEMETRY"):
            os.environ[name] = "1"
        os.environ["TOKENIZERS_PARALLELISM"] = "false"

        self.checkpoint = resolve_checkpoint(checkpoint, allow_auto_discovery=False)
        self.manifest = load_and_verify_manifest(self.checkpoint)

        import torch
        from transformers import AutoModelForSequenceClassification, AutoTokenizer

        self.torch = torch
        torch.set_num_threads(4)

        self.model_version = str(self.manifest["model_version"])
        self.output_kind = str(self.manifest["output_kind"])
        self.aggregation_policy = str(self.manifest["aggregation_policy"])
        self.max_length = int(self.manifest["max_length"])

        id2label = self.manifest["id2label"]
        label_map = self.manifest["label_to_emotion_id"]
        self.index_to_emotion_id = [
            str(label_map[id2label[str(idx)]]) for idx in range(len(EMOTION_IDS))
        ]

        if device not in {"auto", "cpu", "cuda"}:
            raise ValueError("device는 auto, cpu, cuda 중 하나여야 합니다.")
        self.device = ("cuda" if torch.cuda.is_available() else "cpu") if device == "auto" else device
        if self.device == "cuda" and not torch.cuda.is_available():
            raise RuntimeError("CUDA를 사용할 수 없습니다. device='cpu'를 사용하세요.")

        options = {"local_files_only": True, "trust_remote_code": False}
        self.tokenizer = AutoTokenizer.from_pretrained(self.checkpoint, **options)
        self.model = (
            AutoModelForSequenceClassification.from_pretrained(self.checkpoint, **options)
            .to(self.device)
            .eval()
        )

    def predict_record(self, text: str) -> dict[str, object]:
        """Run record-level 10-emotion inference without silent truncation."""
        if self.aggregation_policy != "direct_record_10class":
            raise ModelIntakeError(
                "unsupported_aggregation_runtime",
                f"아직 런타임이 지원하지 않는 집계 정책입니다: {self.aggregation_policy}",
            )

        untruncated = self.tokenizer(text, add_special_tokens=True, truncation=False)
        token_count = len(untruncated["input_ids"])
        if token_count > self.max_length:
            return {
                "model_version": self.model_version,
                "truncated": True,
                "input_tokens": token_count,
                "probabilities": None,
            }

        batch = self.tokenizer(
            text,
            add_special_tokens=True,
            truncation=False,
            return_tensors="pt",
        ).to(self.device)

        with self.torch.inference_mode():
            raw_values = self.model(**batch).logits[0].float().cpu().tolist()

        probabilities = normalize_direct_output(
            raw_values,
            self.output_kind,
            self.index_to_emotion_id,
        )
        return {
            "model_version": self.model_version,
            "truncated": False,
            "input_tokens": token_count,
            "probabilities": probabilities,
        }


class ContractMockPredictor:
    """Explicit opt-in contract mock for DATA-01 / OPS-01 while waiting for real 10-emotion weights."""

    def __init__(self, model_version: str = "contract-mock-v1") -> None:
        self.model_version = model_version

    def predict_record(self, text: str) -> dict[str, object]:
        digest = hashlib.sha256(text.encode("utf-8")).digest()
        primary_idx = digest[0] % len(EMOTION_IDS)
        secondary_idx = (primary_idx + 1) % len(EMOTION_IDS)
        raw = [0.16 / (len(EMOTION_IDS) - 2)] * len(EMOTION_IDS)
        raw[primary_idx] = 0.56
        raw[secondary_idx] = 0.28
        probs = validate_probabilities({eid: val for eid, val in zip(EMOTION_IDS, raw)})
        return {
            "model_version": self.model_version,
            "truncated": False,
            "input_tokens": min(len(text), 256),
            "probabilities": probs,
        }


def create_predictor():
    """Create the supplied nine-class ensemble, or an explicit contract mock."""
    if os.getenv("EMOTION_MOCK_MODE") == "1":
        return ContractMockPredictor()
    from backend.app.ml.ensemble import EnsemblePredictor

    model_dir = os.getenv("EMOTION_MODEL_DIR")
    if not model_dir:
        raise ModelNotReadyError("EMOTION_MODEL_DIR이 설정되지 않았습니다.")
    return EnsemblePredictor(model_dir, device=os.getenv("EMOTION_DEVICE", "auto"))


class EmotionPredictor:
    """Legacy 6-emotion utterance predictor kept for CLI / backward compatibility until CLEAN-01."""

    def __init__(
        self,
        checkpoint: Path | str | None = None,
        study: Path | str | None = None,
        device: str = "auto",
        *,
        allow_auto_discovery: bool = False,
    ) -> None:
        for name in ("HF_HUB_OFFLINE", "TRANSFORMERS_OFFLINE", "HF_HUB_DISABLE_TELEMETRY"):
            os.environ[name] = "1"
        os.environ["TOKENIZERS_PARALLELISM"] = "false"

        import torch
        from transformers import AutoModelForSequenceClassification, AutoTokenizer

        self.torch = torch
        torch.set_num_threads(4)
        self.checkpoint = resolve_checkpoint(
            checkpoint,
            study,
            allow_auto_discovery=allow_auto_discovery,
        )

        metrics_path = self.checkpoint.parent / "metrics.json"
        if metrics_path.is_file():
            settings = json.loads(metrics_path.read_text(encoding="utf-8"))["settings"]
            if settings.get("context_turns") != 0:
                raise ValueError("이 앱은 context_turns=0 체크포인트만 지원합니다.")
            self.max_length = int(settings["max_length"])
        else:
            self.max_length = 256

        if device not in {"auto", "cpu", "cuda"}:
            raise ValueError("device는 auto, cpu, cuda 중 하나여야 합니다.")
        self.device = ("cuda" if torch.cuda.is_available() else "cpu") if device == "auto" else device
        if self.device == "cuda" and not torch.cuda.is_available():
            raise RuntimeError("CUDA를 사용할 수 없습니다. device='cpu'를 사용하세요.")

        options = {"local_files_only": True, "trust_remote_code": False}
        self.tokenizer = AutoTokenizer.from_pretrained(self.checkpoint, **options)
        self.model = (
            AutoModelForSequenceClassification.from_pretrained(self.checkpoint, **options)
            .to(self.device)
            .eval()
        )
        self.model_version = self.checkpoint.name

    def predict(self, utterances: str | list[str]) -> dict[str, object]:
        cleaned = _clean_utterances(utterances)
        text = f" {self.tokenizer.sep_token} ".join(cleaned)
        untruncated = self.tokenizer(text, add_special_tokens=True, truncation=False)
        batch = self.tokenizer(
            text,
            add_special_tokens=True,
            truncation=True,
            max_length=self.max_length,
            return_tensors="pt",
        ).to(self.device)

        with self.torch.inference_mode():
            values = self.model(**batch).logits.float().softmax(-1)[0].cpu().tolist()

        probabilities = {
            self.model.config.id2label[index]: probability
            for index, probability in enumerate(values)
        }
        emotion, confidence = max(probabilities.items(), key=lambda item: item[1])
        return {
            "emotion": emotion,
            "confidence": confidence,
            "probabilities": probabilities,
            "input_tokens": int(batch["input_ids"].shape[1]),
            "truncated": len(untruncated["input_ids"]) > self.max_length,
        }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--study-dir", type=Path)
    parser.add_argument("--checkpoint", type=Path)
    parser.add_argument("--device", choices=["auto", "cpu", "cuda"], default="auto")
    parser.add_argument("--text", nargs="+", required=True, help="사용자 발화 1~3개")
    args = parser.parse_args()

    predictor = EmotionPredictor(
        args.checkpoint,
        args.study_dir,
        args.device,
        allow_auto_discovery=True,
    )
    result = predictor.predict(args.text)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

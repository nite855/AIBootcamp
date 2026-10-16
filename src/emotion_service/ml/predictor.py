"""Load and run the locally saved Korean emotion-classification model."""

import argparse
import csv
import json
import os
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_CHECKPOINT = PROJECT_ROOT / "models" / "emotion-kcelectra" / "checkpoint"
STUDY_NAME = "emotional-dialogue-input-study-20261007-v1"
REQUIRED_CHECKPOINT_FILES = (
    "config.json",
    "model.safetensors",
    "tokenizer_config.json",
)


def _default_study_dir() -> Path:
    """Find an externally saved, complete study artifact."""
    candidates: list[Path] = []
    downloads = Path.home() / "Downloads"
    if downloads.is_dir():
        candidates.extend(downloads.glob(f"{STUDY_NAME}*/{STUDY_NAME}"))

    found = next((candidate for candidate in candidates if (candidate / "study_runs.csv").is_file()), None)
    if found is None:
        raise FileNotFoundError(
            "�⺻ üũ����Ʈ�� ã�� �� �����ϴ�. EMOTION_MODEL_DIR �Ǵ� "
            f"EMOTION_STUDY_DIR�� �����ϼ���: {DEFAULT_CHECKPOINT}"
        )
    return found


def _validate_checkpoint(checkpoint: Path) -> Path:
    checkpoint = checkpoint.expanduser().resolve()
    missing = [name for name in REQUIRED_CHECKPOINT_FILES if not (checkpoint / name).is_file()]
    if missing:
        names = ", ".join(missing)
        raise FileNotFoundError(f"üũ����Ʈ ������ �����ϴ� ({names}): {checkpoint}")
    return checkpoint


def select_checkpoint(study: Path) -> Path:
    """Select the best validation run using the experiment's original metric."""
    runs_path = study.expanduser().resolve() / "study_runs.csv"
    if not runs_path.is_file():
        raise FileNotFoundError(
            "���� ������ ã�� �� �����ϴ�. EMOTION_STUDY_DIR �Ǵ� "
            f"EMOTION_MODEL_DIR�� �����ϼ���: {runs_path}"
        )

    with runs_path.open(encoding="utf-8-sig", newline="") as stream:
        rows = [row for row in csv.DictReader(stream) if row["split"] == "validation_fixed"]
    if not rows:
        raise ValueError(f"validation_fixed ����� �����ϴ�: {runs_path}")

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


def resolve_checkpoint(checkpoint: Path | str | None = None, study: Path | str | None = None) -> Path:
    configured_checkpoint = checkpoint or os.getenv("EMOTION_MODEL_DIR")
    if configured_checkpoint:
        return _validate_checkpoint(Path(configured_checkpoint))

    configured_study = study or os.getenv("EMOTION_STUDY_DIR")
    if configured_study:
        return select_checkpoint(Path(configured_study))
    if DEFAULT_CHECKPOINT.is_dir():
        return _validate_checkpoint(DEFAULT_CHECKPOINT)

    configured_study = _default_study_dir()
    return select_checkpoint(Path(configured_study))


def _clean_utterances(utterances: str | list[str]) -> list[str]:
    if isinstance(utterances, str):
        utterances = [utterances]
    if not isinstance(utterances, list) or not 1 <= len(utterances) <= 3:
        raise ValueError("����� ��ȭ 1~3���� ���ڿ� ������� �Է��ϼ���.")

    cleaned = [" ".join(text.split()) if isinstance(text, str) else "" for text in utterances]
    if any(not text for text in cleaned):
        raise ValueError("�� ��ȭ �Ǵ� ���ڿ��� �ƴ� ��ȭ�� �ֽ��ϴ�.")
    return cleaned


class EmotionPredictor:
    def __init__(
        self,
        checkpoint: Path | str | None = None,
        study: Path | str | None = None,
        device: str = "auto",
    ) -> None:
        for name in ("HF_HUB_OFFLINE", "TRANSFORMERS_OFFLINE", "HF_HUB_DISABLE_TELEMETRY"):
            os.environ[name] = "1"
        os.environ["TOKENIZERS_PARALLELISM"] = "false"

        import torch
        from transformers import AutoModelForSequenceClassification, AutoTokenizer

        self.torch = torch
        torch.set_num_threads(4)
        self.checkpoint = resolve_checkpoint(checkpoint, study)

        metrics_path = self.checkpoint.parent / "metrics.json"
        if metrics_path.is_file():
            settings = json.loads(metrics_path.read_text(encoding="utf-8"))["settings"]
            if settings.get("context_turns") != 0:
                raise ValueError("�� ���� context_turns=0 üũ����Ʈ�� �����մϴ�.")
            self.max_length = int(settings["max_length"])
        else:
            self.max_length = 256

        if device not in {"auto", "cpu", "cuda"}:
            raise ValueError("device�� auto, cpu, cuda �� �ϳ����� �մϴ�.")
        self.device = ("cuda" if torch.cuda.is_available() else "cpu") if device == "auto" else device
        if self.device == "cuda" and not torch.cuda.is_available():
            raise RuntimeError("CUDA�� ����� �� �����ϴ�. device='cpu'�� ����ϼ���.")

        options = {"local_files_only": True, "trust_remote_code": False}
        self.tokenizer = AutoTokenizer.from_pretrained(self.checkpoint, **options)
        self.model = (
            AutoModelForSequenceClassification.from_pretrained(self.checkpoint, **options)
            .to(self.device)
            .eval()
        )

    def predict(self, utterances: str | list[str]) -> dict[str, object]:
        cleaned = _clean_utterances(utterances)
        # The web app sends one utterance. SEP preserves turn boundaries for CLI use.
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
    parser.add_argument("--text", nargs="+", required=True, help="����� ��ȭ 1~3��")
    args = parser.parse_args()

    predictor = EmotionPredictor(args.checkpoint, args.study_dir, args.device)
    result = predictor.predict(args.text)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

"""Offline inference for the supplied pair of flat nine-class KcELECTRA models."""

from contextlib import nullcontext
import hashlib
import json
import os
from pathlib import Path

from backend.app.ml.intake import validate_probabilities

LABEL_TO_ID = {
    "기쁨·활력": "pos_1",
    "만족·감사": "pos_2",
    "안정·자신감": "pos_3",
    "분노": "neg_3",
    "슬픔": "neg_2",
    "불안": "neg_1",
    "객관적 서술": "neu_1",
    "의문": "neu_2",
    "놀람·당황": "neu_3",
}
COMPONENTS = ("weighted_CE_seed42", "weighted_RDrop_seed42")


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


class EnsemblePredictor:
    """Load both supplied checkpoints once and average their nine-class probabilities."""

    def __init__(self, model_dir: Path | str, device: str = "auto") -> None:
        for name in ("HF_HUB_OFFLINE", "TRANSFORMERS_OFFLINE", "HF_HUB_DISABLE_TELEMETRY"):
            os.environ[name] = "1"
        os.environ["TOKENIZERS_PARALLELISM"] = "false"

        import torch
        from torch import nn
        from transformers import AutoConfig, AutoModel, AutoTokenizer

        root = Path(model_dir).expanduser().resolve()
        manifest = json.loads((root / "ensemble_seed42" / "ensemble.json").read_text(encoding="utf-8"))
        labels = manifest.get("labels")
        components = manifest.get("components")
        if labels != list(LABEL_TO_ID) or manifest.get("weights") != [0.5, 0.5]:
            raise ValueError("앙상블의 라벨 또는 가중치가 제공된 9감정 계약과 다릅니다.")
        if not isinstance(components, list) or len(components) != len(COMPONENTS):
            raise ValueError("앙상블에는 두 구성 모델이 필요합니다.")

        if device not in {"auto", "cpu", "cuda"}:
            raise ValueError("device는 auto, cpu, cuda 중 하나여야 합니다.")
        if device == "auto":
            device = "cuda" if torch.cuda.is_available() else "cpu"
        if device == "cuda" and not torch.cuda.is_available():
            raise RuntimeError("CUDA를 사용할 수 없습니다.")
        self.torch = torch
        self.device = torch.device(device)
        torch.set_num_threads(4)
        self.labels = labels
        self.max_length = 256
        self.models = []
        tokenizer_hashes = []
        weight_hashes = []

        class EmotionModel(nn.Module):
            def __init__(self, checkpoint: Path, config: dict, mapping: dict) -> None:
                super().__init__()
                encoder_config = AutoConfig.from_pretrained(
                    checkpoint / "encoder_config", local_files_only=True, trust_remote_code=False
                )
                self.encoder = AutoModel.from_config(encoder_config, trust_remote_code=False)
                self.dropout = nn.Dropout(config.get("head_dropout", 0.1))
                self.register_buffer("parent", torch.tensor(mapping["fine_parent"]))
                self.fine = nn.Linear(encoder_config.hidden_size, len(labels))

            def forward(self, features):
                hidden = self.encoder(**features).last_hidden_state[:, 0]
                return self.fine(self.dropout(hidden))

        for name, component in zip(COMPONENTS, components):
            folder = root / name
            config = json.loads((folder / "config.json").read_text(encoding="utf-8"))
            mapping = json.loads((folder / "label_mapping.json").read_text(encoding="utf-8"))
            if (config.get("structure") != "FL" or config.get("num_labels") != 9
                    or config.get("max_length") != self.max_length
                    or config.get("labels") != labels or mapping.get("fine_labels") != labels
                    or mapping.get("fine_parent") != [0, 0, 0, 1, 1, 1, 2, 2, 2]):
                raise ValueError(f"모델 라벨·구조·입력 한도가 다릅니다: {name}")
            checkpoint = folder / "best_checkpoint"
            weights = checkpoint / "model.pt"
            digest = _sha256(weights)
            if digest != component.get("sha256"):
                raise ValueError(f"모델 가중치 해시가 다릅니다: {name}")
            weight_hashes.append(digest)
            tokenizer_hashes.append(tuple(_sha256(checkpoint / f) for f in (
                "tokenizer.json", "tokenizer_config.json", "special_tokens_map.json"
            )))
            model = EmotionModel(checkpoint, config, mapping)
            model.load_state_dict(torch.load(weights, map_location="cpu", weights_only=True), strict=True)
            self.models.append(model.to(self.device).eval().requires_grad_(False))

        if tokenizer_hashes[0] != tokenizer_hashes[1]:
            raise ValueError("앙상블 토크나이저가 일치하지 않습니다.")
        self.tokenizer = AutoTokenizer.from_pretrained(
            root / COMPONENTS[0] / "best_checkpoint", local_files_only=True, trust_remote_code=False
        )
        self.model_version = "ensemble-seed42-" + "-".join(h[:12] for h in weight_hashes)

    def predict_record(self, text: str) -> dict[str, object]:
        encoded = self.tokenizer(text, add_special_tokens=True, truncation=False)
        token_count = len(encoded["input_ids"])
        if token_count > self.max_length:
            return {"model_version": self.model_version, "truncated": True,
                    "input_tokens": token_count, "probabilities": None}

        features = self.tokenizer(text, add_special_tokens=True, truncation=False, return_tensors="pt")
        features = {key: value.to(self.device) for key, value in features.items()}
        use_bf16 = self.device.type == "cuda" and self.torch.cuda.is_bf16_supported()
        context = self.torch.autocast("cuda", dtype=self.torch.bfloat16) if use_bf16 else nullcontext()
        with self.torch.inference_mode(), context:
            values = [model(features).float().softmax(-1)[0].cpu().tolist() for model in self.models]
        probabilities = validate_probabilities({
            LABEL_TO_ID[label]: (values[0][i] + values[1][i]) / 2
            for i, label in enumerate(self.labels)
        })
        return {"model_version": self.model_version, "truncated": False,
                "input_tokens": token_count, "probabilities": probabilities}

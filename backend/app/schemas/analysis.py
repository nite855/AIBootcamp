"""Request, response, health, and error schemas aligned with contracts/analysis.schema.json."""

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, StrictInt, field_validator

from backend.app.services.validation import validate_non_empty_identifier, validate_record_text

TAXONOMY_VERSION = "emotion-cardex-3plus9-v1"
CARD_POLICY_VERSION = "card-stage-strict-gt-v1"

EmotionId = Literal[
    "pos_1",
    "pos_2",
    "pos_3",
    "neg_1",
    "neg_2",
    "neg_3",
    "neu_1",
    "neu_2",
    "neu_3",
]

EMOTION_IDS: tuple[str, ...] = (
    "pos_1",
    "pos_2",
    "pos_3",
    "neg_1",
    "neg_2",
    "neg_3",
    "neu_1",
    "neu_2",
    "neu_3",
)


class AnalyzeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    record_id: str = Field(min_length=1, max_length=128)
    version: StrictInt = Field(ge=1)
    request_id: str = Field(min_length=1, max_length=128)
    text: str = Field(min_length=1)

    @field_validator("record_id", "request_id")
    @classmethod
    def _check_identifier(cls, value: str) -> str:
        return validate_non_empty_identifier(value)

    @field_validator("text")
    @classmethod
    def _check_text(cls, value: str) -> str:
        return validate_record_text(value)


class AnalyzeSuccessResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    record_id: str = Field(min_length=1, max_length=128)
    version: StrictInt = Field(ge=1)
    request_id: str = Field(min_length=1, max_length=128)
    status: Literal["valid"] = "valid"
    taxonomy_version: Literal["emotion-cardex-3plus9-v1"] = TAXONOMY_VERSION
    model_version: str = Field(min_length=1)
    probabilities: dict[EmotionId, float]
    truncated: Literal[False] = False
    dominant_emotion: EmotionId
    dominant_ratio: float = Field(gt=0.0, le=1.0)
    ties: list[EmotionId] = Field(min_length=1, max_length=9)
    card_stage: Literal[1, 2, 3]
    card_key: str = Field(pattern=r"^(pos_[1-3]|neg_[1-3]|neu_[1-3]):[1-3]$")
    card_policy_version: Literal["card-stage-strict-gt-v1"] = CARD_POLICY_VERSION


class AnalyzeUnissuableResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    record_id: str = Field(min_length=1, max_length=128)
    version: StrictInt = Field(ge=1)
    request_id: str = Field(min_length=1, max_length=128)
    status: Literal["error"] = "error"
    taxonomy_version: Literal["emotion-cardex-3plus9-v1"] = TAXONOMY_VERSION
    model_version: str = Field(min_length=1)
    probabilities: dict[EmotionId, float] | None = None
    truncated: bool
    dominant_emotion: None = None
    dominant_ratio: None = None
    ties: list[EmotionId] = Field(default_factory=list, max_length=0)
    card_stage: None = None
    card_key: None = None
    card_policy_version: Literal["card-stage-strict-gt-v1"] = CARD_POLICY_VERSION
    error_code: str = Field(min_length=1)
    message: str = Field(min_length=1)


AnalyzeResponse = AnalyzeSuccessResponse | AnalyzeUnissuableResponse


class ErrorResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    detail: str | list[dict[str, Any]]
    code: str | None = None
    request_id: str | None = None


class HealthLiveResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Literal["live"] = "live"


class HealthReadyResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Literal["ready", "not_ready"]
    model_loaded: bool
    model_version: str | None = None
    detail: str | None = None

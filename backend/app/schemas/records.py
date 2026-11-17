"""Pydantic schemas for account-scoped diary records, deletion impact, and collected cards."""

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, StrictInt, field_validator

from backend.app.schemas.analysis import EmotionId
from backend.app.services.validation import validate_non_empty_identifier, validate_record_text


class RecordAnalysisOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Literal["pending", "valid", "error"]
    version: int | None = None
    taxonomy_version: str | None = None
    model_version: str | None = None
    probabilities: dict[EmotionId, float] | None = None
    truncated: bool = False
    dominant_emotion: EmotionId | None = None
    dominant_ratio: float | None = None
    ties: list[EmotionId] | None = None
    card_stage: Literal[1, 2, 3] | None = None
    card_key: str | None = None
    card_policy_version: str | None = None
    error_code: str | None = None
    message: str | None = None


class DiaryRecordOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    db_id: str
    text: str
    record_date: date
    version: int
    favorite: bool
    created_at: datetime
    updated_at: datetime
    analysis: RecordAnalysisOut


class RecordListResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    records: list[DiaryRecordOut]
    total_count: int
    max_records: int


class RecordCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    record_id: str = Field(min_length=1, max_length=128)
    text: str = Field(min_length=1)
    record_date: date
    favorite: bool = False

    @field_validator("record_id")
    @classmethod
    def _check_id(cls, value: str) -> str:
        return validate_non_empty_identifier(value)

    @field_validator("text")
    @classmethod
    def _check_text(cls, value: str) -> str:
        return validate_record_text(value)


class RecordUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: str = Field(min_length=1)
    record_date: date | None = None

    @field_validator("text")
    @classmethod
    def _check_text(cls, value: str) -> str:
        return validate_record_text(value)


class RecordFavoriteRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    favorite: bool


class RecordDeleteImpactResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    record_id: str
    has_card_unlock: bool
    card_key: str | None = None
    emotion_id: str | None = None
    card_stage: int | None = None
    remaining_records_with_card: int
    will_relock_card: bool


class RecordDeleteResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    deleted_record_id: str
    deleted_card_unlock: bool
    relocked_card_key: str | None = None


class CollectedCardOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    card_key: str
    emotion_id: EmotionId
    card_stage: Literal[1, 2, 3]
    collect_count: int
    first_collected_at: datetime
    last_collected_at: datetime
    record_ids: list[str]


class CollectedCardsResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    cards: list[CollectedCardOut]
    unlocked_count: int
    total_slots: int = 27


class RecordImportEntry(BaseModel):
    model_config = ConfigDict(extra="forbid")

    record_id: str = Field(min_length=1, max_length=128)
    text: str = Field(min_length=1)
    record_date: date
    favorite: bool = False
    version: StrictInt = Field(default=1, ge=1)
    created_at: datetime | None = None
    updated_at: datetime | None = None

    @field_validator("record_id")
    @classmethod
    def _check_id(cls, value: str) -> str:
        return validate_non_empty_identifier(value)

    @field_validator("text")
    @classmethod
    def _check_text(cls, value: str) -> str:
        return validate_record_text(value)


class RecordImportRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    entries: list[RecordImportEntry] = Field(max_length=100)


class RecordImportResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    added: int
    duplicates: int
    conflicts: int
    total_count: int
    max_records: int

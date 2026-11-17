"""Account-scoped persistence for diary records, emotion analysis snapshots, and collected cards."""

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from backend.app.core.config import get_settings
from backend.app.core.security import utc_now
from backend.app.db.models import CollectedCard, DiaryRecord, User
from backend.app.schemas.analysis import AnalyzeSuccessResponse, AnalyzeUnissuableResponse
from backend.app.schemas.records import (
    CollectedCardOut,
    CollectedCardsResponse,
    DiaryRecordOut,
    RecordAnalysisOut,
    RecordCreateRequest,
    RecordDeleteImpactResponse,
    RecordDeleteResponse,
    RecordFavoriteRequest,
    RecordImportRequest,
    RecordImportResponse,
    RecordListResponse,
    RecordUpdateRequest,
)


class RecordServiceError(ValueError):
    """Domain error with HTTP status, error code, and optional structured details."""

    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        extra: dict[str, object] | None = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.extra = extra or {}


def _clear_analysis_fields(row: DiaryRecord) -> None:
    row.analysis_status = "pending"
    row.model_version = None
    row.taxonomy_version = None
    row.probabilities = None
    row.dominant_emotion = None
    row.dominant_ratio = None
    row.ties = None
    row.card_stage = None
    row.card_key = None
    row.card_policy_version = None
    row.truncated = False
    row.error_code = None
    row.error_message = None


def serialize_record(row: DiaryRecord) -> DiaryRecordOut:
    if row.analysis_status == "valid":
        analysis = RecordAnalysisOut(
            status="valid",
            version=row.version,
            taxonomy_version=row.taxonomy_version,
            model_version=row.model_version,
            probabilities=row.probabilities,
            truncated=False,
            dominant_emotion=row.dominant_emotion,  # type: ignore[arg-type]
            dominant_ratio=row.dominant_ratio,
            ties=row.ties,  # type: ignore[arg-type]
            card_stage=row.card_stage,  # type: ignore[arg-type]
            card_key=row.card_key,
            card_policy_version=row.card_policy_version,
        )
    elif row.analysis_status == "error":
        analysis = RecordAnalysisOut(
            status="error",
            version=row.version,
            taxonomy_version=row.taxonomy_version,
            model_version=row.model_version,
            truncated=row.truncated,
            error_code=row.error_code or "ANALYSIS_ERROR",
            message=row.error_message or "분석을 완료하지 못했어요.",
        )
    else:
        analysis = RecordAnalysisOut(status="pending")

    return DiaryRecordOut(
        id=row.client_record_id,
        db_id=str(row.id),
        text=row.text,
        record_date=row.record_date,
        version=row.version,
        favorite=row.favorite,
        created_at=row.created_at,
        updated_at=row.updated_at,
        analysis=analysis,
    )


def recompute_collected_card(db: Session, user_id: object, card_key: str | None) -> bool:
    """Recompute collected_cards row for (user_id, card_key); returns True if relocked/deleted."""
    if not card_key:
        return False

    matching_records = db.scalars(
        select(DiaryRecord)
        .where(
            DiaryRecord.user_id == user_id,
            DiaryRecord.analysis_status == "valid",
            DiaryRecord.card_key == card_key,
        )
        .order_by(DiaryRecord.created_at.asc(), DiaryRecord.id.asc())
    ).all()

    existing = db.scalar(
        select(CollectedCard).where(
            CollectedCard.user_id == user_id,
            CollectedCard.card_key == card_key,
        )
    )

    if not matching_records:
        if existing is not None:
            db.delete(existing)
            db.flush()
            return True
        return False

    emotion_id, stage_str = card_key.split(":", 1)
    card_stage = int(stage_str)
    first_rec = matching_records[0]
    last_rec = matching_records[-1]

    if existing is None:
        existing = CollectedCard(
            user_id=user_id,
            card_key=card_key,
            emotion_id=emotion_id,
            card_stage=card_stage,
            first_record_id=first_rec.id,
            last_record_id=last_rec.id,
            collect_count=len(matching_records),
            first_collected_at=first_rec.created_at,
            last_collected_at=last_rec.updated_at,
        )
        db.add(existing)
    else:
        existing.emotion_id = emotion_id
        existing.card_stage = card_stage
        existing.first_record_id = first_rec.id
        existing.last_record_id = last_rec.id
        existing.collect_count = len(matching_records)
        existing.first_collected_at = first_rec.created_at
        existing.last_collected_at = last_rec.updated_at

    db.flush()
    return False


def list_records(db: Session, user: User) -> RecordListResponse:
    max_records = get_settings().max_records_per_user
    rows = db.scalars(
        select(DiaryRecord)
        .where(DiaryRecord.user_id == user.id)
        .order_by(DiaryRecord.record_date.desc(), DiaryRecord.created_at.desc())
    ).all()
    return RecordListResponse(
        records=[serialize_record(row) for row in rows],
        total_count=len(rows),
        max_records=max_records,
    )


def _get_user_record(db: Session, user: User, client_record_id: str) -> DiaryRecord:
    row = db.scalar(
        select(DiaryRecord).where(
            DiaryRecord.user_id == user.id,
            DiaryRecord.client_record_id == client_record_id,
        )
    )
    if row is None:
        raise RecordServiceError(404, "RECORD_NOT_FOUND", "기록을 찾을 수 없습니다.")
    return row


def create_record(db: Session, user: User, payload: RecordCreateRequest) -> DiaryRecordOut:
    existing = db.scalar(
        select(DiaryRecord).where(
            DiaryRecord.user_id == user.id,
            DiaryRecord.client_record_id == payload.record_id,
        )
    )
    if existing is not None:
        raise RecordServiceError(409, "DUPLICATE_RECORD_ID", "이미 존재하는 기록 식별자입니다.")

    max_records = get_settings().max_records_per_user
    total = db.scalar(
        select(func.count(DiaryRecord.id)).where(DiaryRecord.user_id == user.id)
    ) or 0
    if total >= max_records:
        raise RecordServiceError(
            409,
            "MAX_RECORDS_REACHED",
            f"기록은 계정당 최대 {max_records}편까지 보관할 수 있습니다.",
        )

    now = utc_now()
    row = DiaryRecord(
        user_id=user.id,
        client_record_id=payload.record_id,
        record_date=payload.record_date,
        text=payload.text,
        version=1,
        favorite=payload.favorite,
        analysis_status="pending",
        created_at=now,
        updated_at=now,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return serialize_record(row)


def update_record(
    db: Session, user: User, client_record_id: str, payload: RecordUpdateRequest
) -> DiaryRecordOut:
    row = _get_user_record(db, user, client_record_id)
    old_card_key = row.card_key if row.analysis_status == "valid" else None

    row.text = payload.text
    if payload.record_date is not None:
        row.record_date = payload.record_date
    row.version += 1
    row.updated_at = utc_now()
    _clear_analysis_fields(row)
    db.flush()

    if old_card_key:
        recompute_collected_card(db, user.id, old_card_key)

    db.commit()
    db.refresh(row)
    return serialize_record(row)


def set_record_favorite(
    db: Session, user: User, client_record_id: str, payload: RecordFavoriteRequest
) -> DiaryRecordOut:
    row = _get_user_record(db, user, client_record_id)
    row.favorite = payload.favorite
    row.updated_at = utc_now()
    db.commit()
    db.refresh(row)
    return serialize_record(row)


def get_delete_impact(
    db: Session, user: User, client_record_id: str
) -> RecordDeleteImpactResponse:
    row = _get_user_record(db, user, client_record_id)
    has_unlock = row.analysis_status == "valid" and bool(row.card_key)
    remaining = 0
    if has_unlock and row.card_key:
        remaining = (
            db.scalar(
                select(func.count(DiaryRecord.id)).where(
                    DiaryRecord.user_id == user.id,
                    DiaryRecord.analysis_status == "valid",
                    DiaryRecord.card_key == row.card_key,
                    DiaryRecord.id != row.id,
                )
            )
            or 0
        )

    return RecordDeleteImpactResponse(
        record_id=row.client_record_id,
        has_card_unlock=has_unlock,
        card_key=row.card_key if has_unlock else None,
        emotion_id=row.dominant_emotion if has_unlock else None,
        card_stage=row.card_stage if has_unlock else None,
        remaining_records_with_card=remaining,
        will_relock_card=has_unlock and remaining == 0,
    )


def delete_record(
    db: Session,
    user: User,
    client_record_id: str,
    *,
    confirm_card_deletion: bool,
) -> RecordDeleteResponse:
    row = _get_user_record(db, user, client_record_id)
    has_unlock = row.analysis_status == "valid" and bool(row.card_key)
    old_card_key = row.card_key if has_unlock else None

    if has_unlock and not confirm_card_deletion:
        impact = get_delete_impact(db, user, client_record_id)
        raise RecordServiceError(
            409,
            "CARD_UNLOCK_CONFIRM_REQUIRED",
            "이 기록 삭제 시 연결된 카드 해금 기록도 함께 삭제됩니다. 2차 확인 후 삭제해 주세요.",
            extra={
                "card_key": impact.card_key,
                "remaining_records_with_card": impact.remaining_records_with_card,
                "will_relock_card": impact.will_relock_card,
            },
        )

    db.delete(row)
    db.flush()

    relocked = recompute_collected_card(db, user.id, old_card_key)
    db.commit()
    return RecordDeleteResponse(
        deleted_record_id=client_record_id,
        deleted_card_unlock=has_unlock,
        relocked_card_key=old_card_key if relocked else None,
    )


def delete_all_records(
    db: Session,
    user: User,
    *,
    confirm_card_deletion: bool,
) -> int:
    unlocked_count = (
        db.scalar(
            select(func.count(CollectedCard.id)).where(CollectedCard.user_id == user.id)
        )
        or 0
    )
    if unlocked_count > 0 and not confirm_card_deletion:
        raise RecordServiceError(
            409,
            "CARD_UNLOCK_CONFIRM_REQUIRED",
            "전체 기록 삭제 시 수집·해금된 카드 기록도 모두 삭제됩니다. 2차 확인 후 삭제해 주세요.",
            extra={"unlocked_card_count": unlocked_count},
        )

    db.execute(delete(CollectedCard).where(CollectedCard.user_id == user.id))
    result = db.execute(delete(DiaryRecord).where(DiaryRecord.user_id == user.id))
    db.commit()
    return int(result.rowcount or 0)


def import_records(db: Session, user: User, payload: RecordImportRequest) -> RecordImportResponse:
    max_records = get_settings().max_records_per_user
    existing_rows = db.scalars(
        select(DiaryRecord).where(DiaryRecord.user_id == user.id)
    ).all()
    by_client_id = {row.client_record_id: row for row in existing_rows}

    additions: list[DiaryRecord] = []
    duplicates = 0
    conflicts = 0

    for entry in payload.entries:
        old = by_client_id.get(entry.record_id)
        if old is None:
            now = utc_now()
            additions.append(
                DiaryRecord(
                    user_id=user.id,
                    client_record_id=entry.record_id,
                    record_date=entry.record_date,
                    text=entry.text,
                    version=entry.version,
                    favorite=entry.favorite,
                    analysis_status="pending",
                    created_at=entry.created_at or now,
                    updated_at=entry.updated_at or now,
                )
            )
            by_client_id[entry.record_id] = additions[-1]
        elif (
            old.text == entry.text
            and old.record_date == entry.record_date
            and old.favorite == entry.favorite
        ):
            duplicates += 1
        else:
            conflicts += 1

    if conflicts > 0:
        raise RecordServiceError(
            409,
            "IMPORT_CONFLICT",
            f"내용이 다른 동일 ID의 기록이 {conflicts}건 있어 합칠 수 없습니다.",
        )

    projected = len(existing_rows) + len(additions)
    if projected > max_records:
        raise RecordServiceError(
            409,
            "MAX_RECORDS_REACHED",
            f"합친 기록({projected}편)이 계정당 보관 한도 {max_records}편을 초과합니다.",
        )

    for item in additions:
        db.add(item)
    db.commit()

    return RecordImportResponse(
        added=len(additions),
        duplicates=duplicates,
        conflicts=conflicts,
        total_count=projected,
        max_records=max_records,
    )


def list_collected_cards(db: Session, user: User) -> CollectedCardsResponse:
    card_rows = db.scalars(
        select(CollectedCard)
        .where(CollectedCard.user_id == user.id)
        .order_by(CollectedCard.emotion_id.asc(), CollectedCard.card_stage.asc())
    ).all()
    valid_records = db.scalars(
        select(DiaryRecord).where(
            DiaryRecord.user_id == user.id,
            DiaryRecord.analysis_status == "valid",
            DiaryRecord.card_key.is_not(None),
        )
    ).all()

    record_ids_by_key: dict[str, list[str]] = {}
    for rec in valid_records:
        if rec.card_key:
            record_ids_by_key.setdefault(rec.card_key, []).append(rec.client_record_id)

    cards = [
        CollectedCardOut(
            card_key=card.card_key,
            emotion_id=card.emotion_id,  # type: ignore[arg-type]
            card_stage=card.card_stage,  # type: ignore[arg-type]
            collect_count=card.collect_count,
            first_collected_at=card.first_collected_at,
            last_collected_at=card.last_collected_at,
            record_ids=record_ids_by_key.get(card.card_key, []),
        )
        for card in card_rows
    ]
    return CollectedCardsResponse(
        cards=cards,
        unlocked_count=len(cards),
        total_slots=27,
    )


def persist_analysis_for_record(
    db: Session,
    user: User,
    *,
    client_record_id: str,
    expected_version: int,
    result: AnalyzeSuccessResponse | AnalyzeUnissuableResponse,
) -> None:
    """Persist inference result onto matching user record and update collected_cards atomically."""
    row = db.scalar(
        select(DiaryRecord).where(
            DiaryRecord.user_id == user.id,
            DiaryRecord.client_record_id == client_record_id,
        )
    )
    if row is None or row.version != expected_version:
        return

    old_card_key = row.card_key if row.analysis_status == "valid" else None

    if isinstance(result, AnalyzeSuccessResponse):
        row.analysis_status = "valid"
        row.model_version = result.model_version
        row.taxonomy_version = result.taxonomy_version
        row.probabilities = dict(result.probabilities)
        row.dominant_emotion = result.dominant_emotion
        row.dominant_ratio = result.dominant_ratio
        row.ties = list(result.ties)
        row.card_stage = result.card_stage
        row.card_key = result.card_key
        row.card_policy_version = result.card_policy_version
        row.truncated = False
        row.error_code = None
        row.error_message = None
    else:
        _clear_analysis_fields(row)
        row.analysis_status = "error"
        row.model_version = result.model_version
        row.taxonomy_version = result.taxonomy_version
        row.card_policy_version = result.card_policy_version
        row.truncated = result.truncated
        row.error_code = result.error_code
        row.error_message = result.message

    row.updated_at = utc_now()
    db.flush()

    if old_card_key and old_card_key != row.card_key:
        recompute_collected_card(db, user.id, old_card_key)
    if row.analysis_status == "valid" and row.card_key:
        recompute_collected_card(db, user.id, row.card_key)

    db.commit()

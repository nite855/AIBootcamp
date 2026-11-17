"""Account-scoped diary record and collected card endpoints (/api/records, /api/cards)."""

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from backend.app.api.deps import require_active_consents
from backend.app.db.models import User
from backend.app.db.session import get_db
from backend.app.schemas.records import (
    CollectedCardsResponse,
    DiaryRecordOut,
    RecordCreateRequest,
    RecordDeleteImpactResponse,
    RecordDeleteResponse,
    RecordFavoriteRequest,
    RecordImportRequest,
    RecordImportResponse,
    RecordListResponse,
    RecordUpdateRequest,
)
from backend.app.services.record_service import (
    RecordServiceError,
    create_record,
    delete_all_records,
    delete_record,
    get_delete_impact,
    import_records,
    list_collected_cards,
    list_records,
    set_record_favorite,
    update_record,
)

router = APIRouter(prefix="/api", tags=["records"])


def _error_response(exc: RecordServiceError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": str(exc), "code": exc.code, **exc.extra},
    )


@router.get("/records", response_model=RecordListResponse)
def get_records(
    current_user: User = Depends(require_active_consents),
    db: Session = Depends(get_db),
) -> RecordListResponse:
    return list_records(db, current_user)


@router.post("/records", response_model=DiaryRecordOut, status_code=201)
def post_record(
    payload: RecordCreateRequest,
    current_user: User = Depends(require_active_consents),
    db: Session = Depends(get_db),
) -> DiaryRecordOut | JSONResponse:
    try:
        return create_record(db, current_user, payload)
    except RecordServiceError as exc:
        db.rollback()
        return _error_response(exc)


@router.post("/records/import", response_model=RecordImportResponse)
def post_import_records(
    payload: RecordImportRequest,
    current_user: User = Depends(require_active_consents),
    db: Session = Depends(get_db),
) -> RecordImportResponse | JSONResponse:
    try:
        return import_records(db, current_user, payload)
    except RecordServiceError as exc:
        db.rollback()
        return _error_response(exc)


@router.put("/records/{record_id}", response_model=DiaryRecordOut)
def put_record(
    record_id: str,
    payload: RecordUpdateRequest,
    current_user: User = Depends(require_active_consents),
    db: Session = Depends(get_db),
) -> DiaryRecordOut | JSONResponse:
    try:
        return update_record(db, current_user, record_id, payload)
    except RecordServiceError as exc:
        db.rollback()
        return _error_response(exc)


@router.patch("/records/{record_id}/favorite", response_model=DiaryRecordOut)
def patch_record_favorite(
    record_id: str,
    payload: RecordFavoriteRequest,
    current_user: User = Depends(require_active_consents),
    db: Session = Depends(get_db),
) -> DiaryRecordOut | JSONResponse:
    try:
        return set_record_favorite(db, current_user, record_id, payload)
    except RecordServiceError as exc:
        db.rollback()
        return _error_response(exc)


@router.get("/records/{record_id}/delete-impact", response_model=RecordDeleteImpactResponse)
def get_record_delete_impact(
    record_id: str,
    current_user: User = Depends(require_active_consents),
    db: Session = Depends(get_db),
) -> RecordDeleteImpactResponse | JSONResponse:
    try:
        return get_delete_impact(db, current_user, record_id)
    except RecordServiceError as exc:
        return _error_response(exc)


@router.delete("/records")
def remove_all_records(
    confirm_card_deletion: bool = Query(default=False),
    current_user: User = Depends(require_active_consents),
    db: Session = Depends(get_db),
) -> dict[str, int] | JSONResponse:
    try:
        deleted_count = delete_all_records(
            db,
            current_user,
            confirm_card_deletion=confirm_card_deletion,
        )
        return {"deleted_count": deleted_count}
    except RecordServiceError as exc:
        db.rollback()
        return _error_response(exc)


@router.delete("/records/{record_id}", response_model=RecordDeleteResponse)
def remove_record(
    record_id: str,
    confirm_card_deletion: bool = Query(default=False),
    current_user: User = Depends(require_active_consents),
    db: Session = Depends(get_db),
) -> RecordDeleteResponse | JSONResponse:
    try:
        return delete_record(
            db,
            current_user,
            record_id,
            confirm_card_deletion=confirm_card_deletion,
        )
    except RecordServiceError as exc:
        db.rollback()
        return _error_response(exc)


@router.get("/cards", response_model=CollectedCardsResponse)
def get_cards(
    current_user: User = Depends(require_active_consents),
    db: Session = Depends(get_db),
) -> CollectedCardsResponse:
    return list_collected_cards(db, current_user)
